// ============================================================
// 定时任务：网站检测 + 订阅到期处理与提醒
// ============================================================

import { toDateStr, diffDays, unixToDateStr } from '../lib/dateutil.js'
import { lunarText } from '../lib/lunar.js'
import { checkMonitor } from '../lib/monitor.js'
import { computeNext, remindThreshold } from '../lib/subscription.js'
import { dispatchChannel } from '../notify/index.js'

// ---------------- 网站监控 ----------------

function monitorDue(monitor, nowSec) {
  if (!monitor.enabled) return false
  if (!monitor.last_checked_at) return true
  const [y, m, d] = monitor.last_checked_at.split('-').map(Number)
  const checkedSec = Date.UTC(y, m - 1, d) / 1000
  return nowSec >= checkedSec + monitor.interval_seconds
}

export async function runMonitors(env) {
  const nowSec = Math.floor(Date.now() / 1000)
  const selfOrigin = await env.KV.get('site:self_origin')
  const { results } = await env.DB.prepare(
    'SELECT * FROM monitors WHERE enabled = 1 AND hidden = 0'
  ).all()
  const due = results.filter((m) => monitorDue(m, nowSec))
  let checked = 0
  for (const m of due) {
    // 逐个检测，避免瞬时并发过高
    await checkMonitor(env, m, selfOrigin)
    checked++
  }
  return { checked, total: results.length }
}

// ---------------- 订阅提醒 ----------------

async function fetchTargetChannels(env, sub) {
  if (sub.channel_ids) {
    const ids = sub.channel_ids
      .split(',')
      .map(Number)
      .filter(Boolean)
    if (ids.length === 0) return []
    const ph = ids.map(() => '?').join(',')
    const { results } = await env.DB.prepare(
      `SELECT * FROM channels WHERE enabled=1 AND id IN (${ph})`
    )
      .bind(...ids)
      .all()
    return results
  }
  const { results } = await env.DB.prepare('SELECT * FROM channels WHERE enabled=1').all()
  return results
}

async function pushReminder(env, sub, daysLeft) {
  const today = toDateStr()
  const title =
    daysLeft < 0
      ? `【到期提醒】${sub.name} 已逾期 ${-daysLeft} 天`
      : daysLeft === 0
        ? `【到期提醒】${sub.name} 今天到期`
        : `【到期提醒】${sub.name} 还有 ${daysLeft} 天到期`
  const lunarInfo = sub.is_lunar
    ? lunarText(...sub.target_date.split('-').map(Number))
    : ''
  const rows = [
    ['名称', sub.name],
    ['到期日期', sub.target_date],
    sub.is_lunar ? ['农历日期', lunarInfo] : null,
    [
      '状态',
      daysLeft < 0 ? `已逾期 ${-daysLeft} 天` : `剩余 ${daysLeft} 天`
    ],
    sub.remark ? ['备注', sub.remark] : null
  ].filter(Boolean)
  const content =
    '<div style="font-family:sans-serif;line-height:1.8">' +
    `<p style="font-size:15px;font-weight:600">${title}</p><table>` +
    rows.map(([k, v]) => `<tr><td style="color:#888;padding-right:16px">${k}</td><td>${v}</td></tr>`).join('') +
    `</table><p style="color:#999;font-size:12px">检查时间：${today}</p></div>`

  const channels = await fetchTargetChannels(env, sub)
  let sent = 0
  for (const channel of channels) {
    let success = 1
    let errText = ''
    try {
      await dispatchChannel(channel, { title, content })
      sent++
    } catch (e) {
      success = 0
      errText = String(e.message || e).slice(0, 500)
    }
    await env.DB.prepare(
      'INSERT INTO notify_logs (subscription_id, channel_id, success, content, created_at) VALUES (?,?,?,?,?)'
    )
      .bind(sub.id, channel.id, success, title + ' | ' + errText, Math.floor(Date.now() / 1000))
      .run()
  }
  return sent
}

/** 处理单个订阅：逾期顺延 + 到期后每天提醒直到续期 */
export async function processSubscription(env, sub) {
  const today = toDateStr()
  const actions = { advanced: false, reminded: false }

  // 1) 已到期
  if (diffDays(today, sub.target_date) < 0) {
    if (sub.type === 'cycle' && sub.auto_renew) {
      // 循环订阅且自动续期：自动顺延到未来，提醒随之停止
      let t = sub.target_date
      for (let i = 0; i < 500 && t < today; i++) {
        t = computeNext({ ...sub, target_date: t }, t)
      }
      await env.DB.prepare(
        `UPDATE subscriptions
           SET target_date=?, pending_renew=0, last_renew_at=?, notified_keys=''
         WHERE id=?`
      )
        .bind(t, sub.target_date, sub.id)
        .run()
      sub.target_date = t
      sub.pending_renew = 0
      sub.notified_keys = ''
      actions.advanced = true
    } else {
      // 到期重置 / 关闭自动续期：保持逾期、标记待续期，每天继续通知直到手动续期
      if (!sub.pending_renew) {
        await env.DB.prepare('UPDATE subscriptions SET pending_renew=1 WHERE id=?')
          .bind(sub.id)
          .run()
        sub.pending_renew = 1
      }
    }
  }

  // 2) 进入提醒窗口（含逾期）：每天发送一次，notified_keys 记录最后发送日期
  const daysLeft = diffDays(today, sub.target_date)
  const threshold = remindThreshold(sub.remind_days)
  if (daysLeft <= threshold && String(sub.notified_keys || '') !== today) {
    await pushReminder(env, sub, daysLeft)
    await env.DB.prepare('UPDATE subscriptions SET notified_keys=? WHERE id=?')
      .bind(today, sub.id)
      .run()
    actions.reminded = true
  }
  return actions
}

export async function runSubscriptions(env) {
  const { results } = await env.DB.prepare('SELECT * FROM subscriptions WHERE enabled=1').all()
  let reminded = 0
  for (const sub of results) {
    const r = await processSubscription(env, sub)
    if (r.reminded) reminded++
  }
  return { processed: results.length, reminded }
}

// ---------------- Cron 入口 ----------------

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const [monitors, subs] = await Promise.all([runMonitors(env), runSubscriptions(env)])
        console.log('cron done', JSON.stringify({ monitors, subs }))
      })()
    )
  }
}
