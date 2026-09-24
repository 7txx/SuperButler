// 统一请求封装（同源 /api，cookie 会话）

async function request(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(path, opts)
  let data = {}
  try {
    data = await r.json()
  } catch {}
  if (r.status === 401) {
    const err = new Error(data.error || '未登录或登录已过期')
    err.code = 401
    throw err
  }
  if (!r.ok) throw new Error(data.error || `请求失败（${r.status}）`)
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: 'POST', body: b }),
  put: (p, b) => request(p, { method: 'PUT', body: b }),
  patch: (p, b) => request(p, { method: 'PATCH', body: b }),
  del: (p) => request(p, { method: 'DELETE' })
}
