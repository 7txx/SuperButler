// ============================================================
// 订阅日期推算（公历周期 / 农历周期）与视图组装
// ============================================================

import { solar2lunar, lunar2solar, lunarText } from './lunar.js'
import { addPeriod, periodText, diffDays, toDateStr, pad2, unixToDateStr } from './dateutil.js'

/** 农历推进一个周期：按农历月日在目标年份重新定位（非闰月） */
export function advanceLunar(target, times = 1) {
  const [y, m, d] = target.split('-').map(Number)
  const l = solar2lunar(y, m, d)
  let targetYear = l.lYear + times
  // 目标年该月若无 30 日则取该月最后一天
  for (let guard = 0; guard < 5; guard++) {
    try {
      const fromLunar = lunar2solar(targetYear, l.lMonth, Math.min(l.lDay, 29), false)
      return `${fromLunar.year}-${pad2(fromLunar.month)}-${pad2(fromLunar.day)}`
    } catch {
      targetYear++
    }
  }
  throw new Error('农历日期推算失败')
}

/** 按订阅配置计算下一次到期日 */
export function computeNext(sub, target = sub.target_date) {
  if (sub.is_lunar) return advanceLunar(target, Math.max(1, sub.period_value))
  return addPeriod(target, sub.period_value, sub.period_unit)
}

/** 提前提醒天数数组，入参可为字符串或数组 */
export function parseRemindDays(v) {
  if (Array.isArray(v)) return v.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
  return String(v || '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)
}

/** 提前提醒阈值（单值，兼容旧的多值数据取最大值） */
export function remindThreshold(v) {
  const list = parseRemindDays(v)
  return list.length ? Math.max(...list) : 7
}

/**
 * 组装给前端的视图字段
 * @param row 订阅数据库行
 * @param today YYYY-MM-DD
 */
export function buildView(row, today) {
  const daysLeft = diffDays(today, row.target_date)
  const baseDate = row.last_renew_at || unixToDateStr(row.created_at)
  const runDays = diffDays(baseDate, today)
  const view = {
    ...row,
    is_lunar: !!row.is_lunar,
    enabled: !!row.enabled,
    auto_renew: !!row.auto_renew,
    pending_renew: !!row.pending_renew,
    remind_days: remindThreshold(row.remind_days),
    channel_ids: String(row.channel_ids || '')
      .split(',')
      .filter(Boolean)
      .map(Number),
    days_left: daysLeft,
    run_days: runDays,
    period_text: periodText(row.period_value, row.period_unit),
    target_lunar: lunarText(...row.target_date.split('-').map(Number)),
    lunar_text: row.is_lunar
      ? lunarText(...row.target_date.split('-').map(Number))
      : ''
  }
  if (row.last_renew_at) {
    view.last_renew_lunar = lunarText(...row.last_renew_at.split('-').map(Number))
  }
  return view
}
