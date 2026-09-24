// 通知渠道 CRUD + 发送测试

import { Hono } from 'hono'
import { CHANNEL_TYPES, dispatchChannel } from '../notify/index.js'

const routes = new Hono()

routes.get('/types', (c) => c.json(CHANNEL_TYPES))

routes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, type, enabled, created_at FROM channels ORDER BY id ASC'
  ).all()
  return c.json(results.map((r) => ({ ...r, enabled: !!r.enabled })))
})

routes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const type = String(body.type || '').trim()
  if (!name) return c.json({ error: '请填写渠道名称' }, 400)
  if (!CHANNEL_TYPES[type]) return c.json({ error: '渠道类型不支持' }, 400)
  const config = body.config && typeof body.config === 'object' ? body.config : {}
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    'INSERT INTO channels (name, type, config, enabled, created_at) VALUES (?,?,?,?,?)'
  )
    .bind(name, type, JSON.stringify(config), body.enabled === false ? 0 : 1, now)
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const channel = await c.env.DB.prepare('SELECT * FROM channels WHERE id=?').bind(id).first()
  if (!channel) return c.json({ error: '渠道不存在' }, 404)
  return c.json({ ...channel, enabled: !!channel.enabled })
})

// 仅启停（不触碰 config）
routes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  if (typeof body.enabled === 'boolean') {
    await c.env.DB.prepare('UPDATE channels SET enabled=? WHERE id=?')
      .bind(body.enabled ? 1 : 0, id)
      .run()
  }
  return c.json({ ok: true })
})

routes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM channels WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '渠道不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return c.json({ error: '请填写渠道名称' }, 400)
  const config = body.config && typeof body.config === 'object' ? body.config : {}
  await c.env.DB.prepare(
    'UPDATE channels SET name=?, config=?, enabled=? WHERE id=?'
  )
    .bind(name, JSON.stringify(config), body.enabled === false ? 0 : 1, id)
    .run()
  return c.json({ ok: true })
})

routes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM channels WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

routes.post('/:id/test', async (c) => {
  const id = Number(c.req.param('id'))
  const channel = await c.env.DB.prepare('SELECT * FROM channels WHERE id=?').bind(id).first()
  if (!channel) return c.json({ error: '渠道不存在' }, 404)
  try {
    await dispatchChannel(channel, {
      title: '【Lover 测试】通知渠道连通正常',
      content:
        '<h3>测试通知</h3><p>如果您收到这条消息，说明该通知渠道配置正确，订阅到期提醒可以正常送达。</p>'
    })
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 502)
  }
})

export default routes
