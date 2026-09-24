// 网站监控 CRUD + 手动检测

import { Hono } from 'hono'
import { toDateStr, normalizeUrl } from '../lib/dateutil.js'
import { checkMonitor } from '../lib/monitor.js'

const routes = new Hono()

// 列表；filter: all|up|down
routes.get('/', async (c) => {
  const filter = c.req.query('filter')
  const q = String(c.req.query('q') || '').trim()
  let sql = 'SELECT * FROM monitors WHERE hidden = 0'
  const binds = []
  if (filter === 'up' || filter === 'down') {
    sql += ' AND status = ?'
    binds.push(filter)
  }
  if (q) {
    sql += ' AND name LIKE ?'
    binds.push(`%${q}%`)
  }
  sql += ' ORDER BY sort_order ASC, id ASC'
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results.map((r) => ({ ...r, enabled: !!r.enabled, hidden: !!r.hidden })))
})

routes.post('/check-all', async (c) => {
  const selfOrigin = new URL(c.req.url).origin
  await c.env.KV.put('site:self_origin', selfOrigin)
  const { results } = await c.env.DB.prepare('SELECT * FROM monitors WHERE hidden = 0').all()
  let up = 0
  let down = 0
  for (const m of results) {
    const r = await checkMonitor(c.env, m, selfOrigin)
    if (r.status === 'up') up++
    else down++
  }
  return c.json({ ok: true, total: results.length, up, down })
})

routes.post('/:id/check', async (c) => {
  const id = Number(c.req.param('id'))
  const monitor = await c.env.DB.prepare('SELECT * FROM monitors WHERE id=?').bind(id).first()
  if (!monitor) return c.json({ error: '网站不存在' }, 404)
  const selfOrigin = new URL(c.req.url).origin
  await c.env.KV.put('site:self_origin', selfOrigin)
  const result = await checkMonitor(c.env, monitor, selfOrigin)
  return c.json({ ok: true, ...result })
})

routes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const url = normalizeUrl(body.url)
  if (!name) return c.json({ error: '请填写名称' }, 400)
  if (!url) return c.json({ error: '请填写有效的网址' }, 400)
  const interval = Math.max(60, parseInt(body.interval_seconds, 10) || 3600)
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    `INSERT INTO monitors (name, url, interval_seconds, enabled, created_at)
     VALUES (?,?,?,?,?)`
  )
    .bind(name, url, interval, body.enabled === false ? 0 : 1, now)
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM monitors WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '网站不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const url = normalizeUrl(body.url)
  if (!name) return c.json({ error: '请填写名称' }, 400)
  if (!url) return c.json({ error: '请填写有效的网址' }, 400)
  const interval = Math.max(60, parseInt(body.interval_seconds, 10) || 3600)
  await c.env.DB.prepare(
    'UPDATE monitors SET name=?, url=?, interval_seconds=?, enabled=? WHERE id=?'
  )
    .bind(name, url, interval, body.enabled === false ? 0 : 1, id)
    .run()
  return c.json({ ok: true })
})

routes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM monitors WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

export default routes
