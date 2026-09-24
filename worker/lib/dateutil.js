// ============================================================
// 日期工具：全部基于 UTC 整日运算，避免时区/夏令时误差
// ============================================================

export function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

/** Date -> YYYY-MM-DD（UTC） */
export function toDateStr(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** YYYY-MM-DD -> Date(UTC 零点) */
export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** 日期差：b - a（天），入参为 YYYY-MM-DD */
export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000)
}

/** unix 秒 -> YYYY-MM-DD（UTC） */
export function unixToDateStr(sec) {
  return toDateStr(new Date(sec * 1000))
}

/**
 * 公历日期加周期
 * @param s YYYY-MM-DD
 * @param value 数量
 * @param unit day | month | year
 */
export function addPeriod(s, value, unit) {
  const [y, m, d] = String(s).split('-').map(Number)
  if (unit === 'day') {
    const dt = parseDate(s)
    dt.setUTCDate(dt.getUTCDate() + value)
    return toDateStr(dt)
  }
  if (unit === 'month' || unit === 'year') {
    const addM = unit === 'month' ? value : value * 12
    const total = (y * 12 + (m - 1) + addM)
    const ny = Math.floor(total / 12)
    const nm = (total % 12) + 1
    // 处理 1/31 + 1 月这类月末溢出：截到目标月最后一天
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
    const nd = Math.min(d, lastDay)
    return `${ny}-${pad2(nm)}-${pad2(nd)}`
  }
  throw new Error(`不支持的周期单位: ${unit}`)
}

/** 周期中文显示，如 "1年"、"180天"、"3月" */
export function periodText(value, unit) {
  const map = { day: '天', month: '月', year: '年' }
  return `${value}${map[unit] || unit}`
}

/** 校验并规范化 URL，失败返回 null */
export function normalizeUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  let u = s
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  try {
    const url = new URL(u)
    if (!url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}
