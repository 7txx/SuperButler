// 账户：修改用户名 / 密码

import { Hono } from 'hono'
import { hashPassword, verifyPassword } from '../lib/auth.js'

const routes = new Hono()

routes.get('/', async (c) => {
  const admin = await c.env.DB.prepare('SELECT username FROM admins WHERE id=1').first()
  return c.json({ username: admin ? admin.username : '' })
})

routes.put('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE id=1').first()
  if (!admin) return c.json({ error: '管理员不存在' }, 404)

  const newUsername = String(body.username || '').trim()
  const newPassword = String(body.new_password || '')
  const oldPassword = String(body.old_password || '')

  if (!newUsername) return c.json({ error: '用户名不能为空' }, 400)
  if (newPassword && newPassword.length < 6) {
    return c.json({ error: '新密码至少 6 位' }, 400)
  }
  if (newPassword) {
    const ok = await verifyPassword(oldPassword, admin.salt, admin.password_hash)
    if (!ok) return c.json({ error: '原密码不正确' }, 400)
  }

  let sql = 'UPDATE admins SET username=?'
  const binds = [newUsername]
  if (newPassword) {
    const { salt, hash } = await hashPassword(newPassword)
    sql += ', password_hash=?, salt=?'
    binds.push(hash, salt)
  }
  sql += ', updated_at=? WHERE id=1'
  binds.push(Math.floor(Date.now() / 1000))
  await c.env.DB.prepare(sql).bind(...binds).run()
  return c.json({ ok: true, username: newUsername })
})

export default routes
