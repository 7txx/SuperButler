// 服务器状态检查与告警：离线、资源阈值、到期提醒
// 复用现有通知渠道（PushPlus / Resend），由 cron 每 5 分钟执行一次

import { dispatchChannel } from '../notify/index.js'
import { toDateStr, diffDays } from './dateutil.js'

const OFFLINE_SECONDS = 180 // 3 个上报周期未上报视为离线
const METRIC_FRESH_SECONDS = 600 // 超过 10 分钟的指标不参与资源告警
const EXPIRY_DAYS = 7
const EXPIRY_GRACE_DAYS = 3
const METRIC_RETENTION_DAYS = 30 // 指标历史保留天数

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pct(used, total) {
  const t = Number(total) || 0
  if (t <= 0) return null
  return Math.round((Number(used) / t) * 1000) / 10
}

function bytesText(n) {
  const v = Number(n) || 0
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let x = v
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function alertHtml(server, title, rows) {
  return (
    '<div style="font-family:sans-serif;line-height:1.8">' +
    `<p style="font-size:15px;font-weight:600">${esc(title)}</p><table>` +
    rows
      .filter(Boolean)
      .map(([k, v]) => `<tr><td style="color:#888;padding-right:16px">${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('') +
    `</table><p style="color:#999;font-size:12px">检查时间：${toDateStr()}</p></div>`
  )
}

async function targetChannels(env, server) {
  if (server.channel_ids) {
    const ids = String(server.channel_ids)
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

async function sendAlert(env, server, title, rows) {
  const channels = await targetChannels(env, server)
  const content = alertHtml(server, title, rows)
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
      .bind(null, channel.id, success, `[服务器 ${server.name}] ${title} | ${errText}`, Math.floor(Date.now() / 1000))
      .run()
  }
  return sent
}

function alertConfig(server) {
  let cfg = {}
  try {
    cfg = JSON.parse(server.alert_config || '{}')
  } catch {}
  return {
    cpu: Number(cfg.cpu) || 90,
    mem: Number(cfg.mem) || 90,
    disk: Number(cfg.disk) || 90
  }
}

/**
 * 清理过期指标（默认保留 30 天），每天最多执行一次
 */
async function cleanupOldMetrics(env, today) {
  const flagKey = 'server:metrics_cleanup_date'
  try {
    const last = await env.KV.get(flagKey)
    if (last === today) return 0
    const cutoff = Math.floor(Date.now() / 1000) - METRIC_RETENTION_DAYS * 86400
    const res = await env.DB.prepare('DELETE FROM server_metrics WHERE ts < ?').bind(cutoff).run()
    await env.KV.put(flagKey, today)
    return res.meta?.changes || 0
  } catch {
    return 0
  }
}

/**
 * 检查全部服务器：更新在线状态，按状态变化推送离线/恢复、资源阈值、到期提醒
 */
export async function runServerChecks(env) {
  const now = Math.floor(Date.now() / 1000)
  const today = toDateStr()
  const metricsRemoved = await cleanupOldMetrics(env, today)
  const { results } = await env.DB.prepare('SELECT * FROM servers').all()
  const summary = { checked: results.length, online: 0, offline: 0, alerts: 0, metricsRemoved }

  for (const server of results) {
    const hasReported = server.last_seen != null
    const online = hasReported && now - Number(server.last_seen) <= OFFLINE_SECONDS
    if (online) summary.online++
    else if (hasReported) summary.offline++

    const newStatus = online ? 'online' : 'offline'
    if (server.status !== newStatus) {
      await env.DB.prepare('UPDATE servers SET status=? WHERE id=?').bind(newStatus, server.id).run()
    }

    if (!server.alert_enabled) continue

    const states = new Set(String(server.alert_state || '').split(',').filter(Boolean))
    let changed = false
    let sent = 0

    // 1) 离线 / 恢复
    if (hasReported && !online && !states.has('offline')) {
      states.add('offline')
      changed = true
      sent += await sendAlert(env, server, `【服务器离线】${server.name}`, [
        ['服务器', server.name],
        ['IP', server.ip || '—'],
        ['最后上报', new Date(Number(server.last_seen) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
        ['状态', '超过 3 分钟未收到 Agent 上报']
      ])
    } else if (online && states.has('offline')) {
      states.delete('offline')
      changed = true
      sent += await sendAlert(env, server, `【服务器恢复】${server.name} 已恢复在线`, [
        ['服务器', server.name],
        ['IP', server.ip || '—'],
        ['状态', 'Agent 上报已恢复']
      ])
    }

    // 2) 资源阈值（仅在线且指标新鲜）
    if (online) {
      const metric = await env.DB.prepare(
        'SELECT * FROM server_metrics WHERE server_id=? ORDER BY ts DESC LIMIT 1'
      )
        .bind(server.id)
        .first()

      if (metric && now - Number(metric.ts) <= METRIC_FRESH_SECONDS) {
        const cfg = alertConfig(server)
        const checks = [
          ['cpu', Number(metric.cpu), cfg.cpu, 'CPU 使用率', `${Number(metric.cpu).toFixed(1)}%`],
          ['mem', pct(metric.mem_used, metric.mem_total), cfg.mem, '内存使用率', `${pct(metric.mem_used, metric.mem_total)}%`],
          ['disk', pct(metric.disk_used, metric.disk_total), cfg.disk, '磁盘使用率', `${pct(metric.disk_used, metric.disk_total)}%`]
        ]

        for (const [key, value, threshold, label, valueText] of checks) {
          if (value == null || !Number.isFinite(value)) continue
          const breach = value >= threshold
          if (breach && !states.has(key)) {
            states.add(key)
            changed = true
            sent += await sendAlert(env, server, `【服务器告警】${server.name} ${label}过高`, [
              ['服务器', server.name],
              ['IP', server.ip || '—'],
              ['指标', label],
              ['当前值', valueText],
              ['阈值', `${threshold}%`],
              ['内存', metric.mem_total ? `${bytesText(metric.mem_used)} / ${bytesText(metric.mem_total)}` : null],
              ['磁盘', metric.disk_total ? `${bytesText(metric.disk_used)} / ${bytesText(metric.disk_total)}` : null]
            ])
          } else if (!breach && states.has(key)) {
            states.delete(key)
            changed = true
            sent += await sendAlert(env, server, `【服务器恢复】${server.name} ${label}已恢复正常`, [
              ['服务器', server.name],
              ['指标', label],
              ['当前值', valueText],
              ['阈值', `${threshold}%`]
            ])
          }
        }
      }
    }

    // 3) 到期提醒（到期前 7 天到逾期 3 天内，每天一次）
    if (server.expire_date) {
      const daysLeft = diffDays(today, server.expire_date)
      if (
        daysLeft <= EXPIRY_DAYS &&
        daysLeft >= -EXPIRY_GRACE_DAYS &&
        server.expire_notice_date !== today
      ) {
        const title =
          daysLeft < 0
            ? `【服务器到期】${server.name} 已逾期 ${-daysLeft} 天`
            : daysLeft === 0
              ? `【服务器到期】${server.name} 今天到期`
              : `【服务器到期】${server.name} 还有 ${daysLeft} 天到期`
        sent += await sendAlert(env, server, title, [
          ['服务器', server.name],
          ['IP', server.ip || '—'],
          ['到期日期', server.expire_date],
          ['账单', server.bill || '—']
        ])
        await env.DB.prepare('UPDATE servers SET expire_notice_date=? WHERE id=?')
          .bind(today, server.id)
          .run()
      }
    }

    if (changed) {
      await env.DB.prepare('UPDATE servers SET alert_state=? WHERE id=?')
        .bind([...states].join(','), server.id)
        .run()
    }
    summary.alerts += sent
  }

  return summary
}
