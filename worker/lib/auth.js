// ============================================================
// 认证：PBKDF2-SHA256 口令哈希 + KV 会话 + Hono 中间件
// ============================================================

const SESSION_COOKIE = 'lover_session'
const SESSION_TTL = 86400 * 7 // 7 天
const ITERATIONS = 100000

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

/** 生成口令哈希 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) }
}

/** 校验口令 */
export async function verifyPassword(password, saltHex, expectedHash) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return bytesToHex(new Uint8Array(bits)) === expectedHash
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

/** 创建会话，返回 Cookie 头值 */
export async function createSession(env, admin) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  await env.KV.put(
    `sess:${token}`,
    JSON.stringify({ id: admin.id, username: admin.username }),
    { expirationTtl: SESSION_TTL }
  )
  return token
}

export async function destroySession(env, token) {
  if (token) await env.KV.delete(`sess:${token}`)
}

export function getSessionToken(c) {
  return parseCookies(c.req.header('Cookie') || '')[SESSION_COOKIE]
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}`
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/** 受保护路由中间件 */
export async function requireAdmin(c, next) {
  const token = getSessionToken(c)
  if (!token) return c.json({ error: '未登录' }, 401)
  const raw = await c.env.KV.get(`sess:${token}`)
  if (!raw) return c.json({ error: '会话已过期，请重新登录' }, 401)
  c.set('admin', JSON.parse(raw))
  c.set('sessionToken', token)
  await next()
}
