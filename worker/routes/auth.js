// 认证路由（含公开接口：状态查询、初始化管理员、登录、登出）

import { Hono } from 'hono'
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionToken,
  sessionCookie,
  clearCookie
} from '../lib/auth.js'

const routes = new Hono()

// 是否已有管理员（决定登录页展示初始化表单还是登录表单）
routes.get('/status', async (c) => {
  // 顺带记住本站对外域名，供定时任务识别"本机自检"
  const origin = new URL(c.req.url).origin
  const saved = await c.env.KV.get('site:self_origin')
  if (saved !== origin) await c.env.KV.put('site:self_origin', origin)
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first()
  return c.json({ hasAdmin: row.n > 0 })
})

// 首次部署：创建唯一管理员并直接登录
routes.post('/setup', async (c) => {
  const existing = await c.env.DB.prepare('SELECT id FROM admins LIMIT 1').first()
  if (existing) return c.json({ error: '管理员已存在，无需初始化' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (!username || password.length < 6) {
    return c.json({ error: '请输入用户名，且密码至少 6 位' }, 400)
  }
  const { salt, hash } = await hashPassword(password)
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    'INSERT INTO admins (id, username, password_hash, salt, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)'
  )
    .bind(username, hash, salt, now, now)
    .run()
  const token = await createSession(c.env, { id: 1, username })
  c.header('Set-Cookie', sessionCookie(token))
  return c.json({ ok: true, username })
})

// 登录
routes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (!username || !password) return c.json({ error: '请输入用户名和密码' }, 400)
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE username = ?')
    .bind(username)
    .first()
  if (!admin) return c.json({ error: '用户名或密码错误' }, 401)
  const ok = await verifyPassword(password, admin.salt, admin.password_hash)
  if (!ok) return c.json({ error: '用户名或密码错误' }, 401)
  const token = await createSession(c.env, { id: admin.id, username: admin.username })
  c.header('Set-Cookie', sessionCookie(token))
  return c.json({ ok: true, username: admin.username })
})

// 当前登录信息
routes.get('/me', async (c) => {
  const token = getSessionToken(c)
  if (!token) return c.json({ login: false })
  const raw = await c.env.KV.get(`sess:${token}`)
  if (!raw) return c.json({ login: false })
  return c.json({ login: true, ...JSON.parse(raw) })
})

// 登出
routes.post('/logout', async (c) => {
  const token = getSessionToken(c)
  await destroySession(c.env, token)
  c.header('Set-Cookie', clearCookie())
  return c.json({ ok: true })
})

export default routes
