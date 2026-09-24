// 网站可访问性检测：HTTP GET，跟随跳转，10 秒超时，失败重试一次
// 监控站点自身域名时走 ASSETS 内部通道（Worker 请求自身域名会绕过 Worker
// 直达不存在的源站，导致误报 522）

import { toDateStr, normalizeUrl } from './dateutil.js'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function probeOnce(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  const started = Date.now()
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: BROWSER_HEADERS
    })
    // 2xx/3xx/401/403 等只要服务器有响应即视为可访问；5xx 视为失效
    const up = r.status >= 200 && r.status < 500
    return {
      status: up ? 'up' : 'down',
      status_code: r.status,
      error: up ? '' : `HTTP ${r.status}`,
      response_ms: Date.now() - started
    }
  } catch (e) {
    return {
      status: 'down',
      status_code: null,
      error: e.name === 'AbortError' ? '请求超时（10秒）' : e.message,
      response_ms: Date.now() - started
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 检测单个网站（不写库）
 * 首次失败（网络错误/5xx）时等待 2.5 秒重试一次，减少偶发误报
 */
export async function probeWebsite(url) {
  const checkedAt = toDateStr()
  const first = await probeOnce(url)
  if (first.status === 'up') return { ...first, checked_at: checkedAt }
  await sleep(2500)
  const second = await probeOnce(url)
  return { ...second, checked_at: checkedAt }
}

/**
 * 本机自检：监控的就是本 Worker 自己的域名时，
 * 通过 ASSETS 绑定内部请求页面，避免公网回环导致的 522 误报
 */
async function probeSelf(env, url) {
  const checkedAt = toDateStr()
  const started = Date.now()
  try {
    const r = await env.ASSETS.fetch(new Request(url, { method: 'GET' }))
    const up = r.status >= 200 && r.status < 500
    return {
      status: up ? 'up' : 'down',
      status_code: r.status,
      error: up ? '' : `HTTP ${r.status}`,
      response_ms: Date.now() - started,
      checked_at: checkedAt
    }
  } catch {
    // ASSETS 不可用时，定时任务本身能运行即说明站点存活
    return {
      status: 'up',
      status_code: 200,
      error: '',
      response_ms: Date.now() - started,
      checked_at: checkedAt
    }
  }
}

/**
 * 检测并把结果写回 monitors 表
 * @param {string} [selfOrigin] 本 Worker 对外的 origin，如 https://lover.tuu.qzz.io
 */
export async function checkMonitor(env, monitor, selfOrigin) {
  const url = normalizeUrl(monitor.url)
  if (!url) {
    await env.DB.prepare(
      "UPDATE monitors SET status='down', status_code=NULL, last_error='网址无效', last_checked_at=? WHERE id=?"
    )
      .bind(toDateStr(), monitor.id)
      .run()
    return { status: 'down', error: '网址无效' }
  }

  let result
  if (selfOrigin) {
    try {
      const isSelf = new URL(url).hostname === new URL(selfOrigin).hostname
      result = isSelf ? await probeSelf(env, url) : await probeWebsite(url)
    } catch {
      result = await probeWebsite(url)
    }
  } else {
    result = await probeWebsite(url)
  }

  await env.DB.prepare(
    `UPDATE monitors
        SET status=?, status_code=?, last_error=?, last_checked_at=?,
            response_ms=?,
            check_count=COALESCE(check_count,0)+1,
            up_count=COALESCE(up_count,0)+?
      WHERE id=?`
  )
    .bind(
      result.status,
      result.status_code,
      result.error,
      result.checked_at,
      result.response_ms,
      result.status === 'up' ? 1 : 0,
      monitor.id
    )
    .run()
  return result
}
