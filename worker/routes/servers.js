// 服务器管理 CRUD + 安装命令 + 手动检查

import { Hono } from 'hono'
import { runServerChecks } from '../lib/server-check.js'

const routes = new Hono()

const OFFLINE_SECONDS = 180

function newToken() {
  return crypto.randomUUID().replace(/-/g, '')
}

function parseRow(row) {
  const now = Math.floor(Date.now() / 1000)
  return {
    ...row,
    hidden: !!row.hidden,
    alert_enabled: !!row.alert_enabled,
    online: row.last_seen != null && now - Number(row.last_seen) <= OFFLINE_SECONDS
  }
}

function readFields(body) {
  const expire = String(body.expire_date || '').trim()
  const channelIds = Array.isArray(body.channel_ids)
    ? body.channel_ids.map(Number).filter(Boolean).join(',')
    : String(body.channel_ids || '').replace(/[^0-9,]/g, '')
  return {
    name: String(body.name || '').trim().slice(0, 80),
    flag: String(body.flag || '').trim().slice(0, 16),
    region: String(body.region || '').trim().slice(0, 80),
    ip: String(body.ip || '').trim().slice(0, 100),
    group_name: String(body.group_name || '').trim().slice(0, 40),
    bill: String(body.bill || '').trim().slice(0, 80),
    expire_date: /^\d{4}-\d{2}-\d{2}$/.test(expire) ? expire : '',
    traffic_reset_day: Math.min(31, Math.max(1, parseInt(body.traffic_reset_day, 10) || 1)),
    sort_order: parseInt(body.sort_order, 10) || 0,
    hidden: body.hidden ? 1 : 0,
    alert_enabled: body.alert_enabled === false ? 0 : 1,
    channel_ids: channelIds
  }
}

routes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM servers ORDER BY sort_order ASC, id ASC'
  ).all()
  return c.json(results.map(parseRow))
})

// 手动检查一次离线/到期状态（会按需推送告警）
routes.post('/check', async (c) => {
  const summary = await runServerChecks(c.env)
  return c.json({ ok: true, ...summary })
})

// 生成 Agent 安装命令
routes.get('/:id/install', async (c) => {
  const id = Number(c.req.param('id'))
  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE id=?').bind(id).first()
  if (!server) return c.json({ error: '服务器不存在' }, 404)
  const origin = new URL(c.req.url).origin
  const command =
    `curl -fsSL ${origin}/agent/sb-agent.sh -o /tmp/sb-agent.sh && ` +
    `sudo sh /tmp/sb-agent.sh install --url ${origin} --token ${server.agent_token} ` +
    `--interval 60 --reset-day ${server.traffic_reset_day}`
  return c.json({
    report_url: `${origin}/api/agent/report`,
    script_url: `${origin}/agent/sb-agent.sh`,
    token: server.agent_token,
    command
  })
})

routes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const f = readFields(body)
  if (!f.name) return c.json({ error: '请填写服务器名称' }, 400)
  const token = newToken()
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    `INSERT INTO servers
       (name, flag, region, ip, group_name, agent_token, traffic_reset_day,
        expire_date, bill, hidden, sort_order, alert_enabled, channel_ids, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      f.name,
      f.flag,
      f.region,
      f.ip,
      f.group_name,
      token,
      f.traffic_reset_day,
      f.expire_date,
      f.bill,
      f.hidden,
      f.sort_order,
      f.alert_enabled,
      f.channel_ids,
      now
    )
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id, token })
})

routes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM servers WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '服务器不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const f = readFields(body)
  if (!f.name) return c.json({ error: '请填写服务器名称' }, 400)
  await c.env.DB.prepare(
    `UPDATE servers
        SET name=?, flag=?, region=?, ip=?, group_name=?, traffic_reset_day=?,
            expire_date=?, bill=?, hidden=?, sort_order=?, alert_enabled=?,
            channel_ids=?
      WHERE id=?`
  )
    .bind(
      f.name,
      f.flag,
      f.region,
      f.ip,
      f.group_name,
      f.traffic_reset_day,
      f.expire_date,
      f.bill,
      f.hidden,
      f.sort_order,
      f.alert_enabled,
      f.channel_ids,
      id
    )
    .run()
  return c.json({ ok: true })
})

// 复制一台服务器（生成新的 Token，元数据保留）
routes.post('/:id/duplicate', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM servers WHERE id=?').bind(id).first()
  if (!row) return c.json({ error: '服务器不存在' }, 404)
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    `INSERT INTO servers
       (name, flag, region, ip, group_name, agent_token, traffic_reset_day,
        expire_date, bill, hidden, sort_order, alert_enabled, channel_ids, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      `${row.name} 副本`,
      row.flag,
      row.region,
      row.ip,
      row.group_name,
      newToken(),
      row.traffic_reset_day,
      row.expire_date,
      row.bill,
      row.hidden,
      (Number(row.sort_order) || 0) + 1,
      row.alert_enabled,
      row.channel_ids,
      now
    )
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.post('/:id/rotate-token', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM servers WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '服务器不存在' }, 404)
  const token = newToken()
  await c.env.DB.prepare(
    "UPDATE servers SET agent_token=?, status='offline', last_seen=NULL, alert_state='' WHERE id=?"
  )
    .bind(token, id)
    .run()
  return c.json({ ok: true, token })
})

routes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM server_metrics WHERE server_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM servers WHERE id=?').bind(id)
  ])
  return c.json({ ok: true })
})

export default routes
