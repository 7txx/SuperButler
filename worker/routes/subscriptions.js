// 订阅 CRUD + 手动续期

import { Hono } from 'hono'
import { solar2lunar } from '../lib/lunar.js'
import { toDateStr } from '../lib/dateutil.js'
import { buildView, computeNext, parseRemindDays } from '../lib/subscription.js'

const routes = new Hono()

// 列表（含搜索）
routes.get('/', async (c) => {
  const q = String(c.req.query('q') || '').trim()
  let sql = 'SELECT * FROM subscriptions'
  const binds = []
  if (q) {
    sql += ' WHERE name LIKE ? OR remark LIKE ? OR tags LIKE ?'
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY sort_order ASC, target_date ASC'
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  const today = toDateStr()
  return c.json(results.map((r) => buildView(r, today)))
})

function normalizeBody(body) {
  const unit = ['day', 'month', 'year'].includes(body.period_unit) ? body.period_unit : 'year'
  const remindDays = parseRemindDays(body.remind_days)
  const remindTime = /^\d{2}:\d{2}$/.test(String(body.remind_time || ''))
    ? String(body.remind_time)
    : '08:00'
  return {
    name: String(body.name || '').trim(),
    remark: String(body.remark || '').trim(),
    renew_link: String(body.renew_link || '').trim().slice(0, 500),
    type: 'cycle',
    is_lunar: body.is_lunar ? 1 : 0,
    target_date: String(body.target_date || '').slice(0, 10),
    period_value: Math.max(1, parseInt(body.period_value, 10) || 1),
    period_unit: unit,
    remind_days: String(remindDays.length ? remindDays[0] : 7),
    remind_time: remindTime,
    renew_offset_days: Math.max(0, parseInt(body.renew_offset_days, 10) || 0),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
    auto_renew: body.auto_renew === false || body.auto_renew === 0 ? 0 : 1,
    channel_ids: Array.isArray(body.channel_ids)
      ? body.channel_ids.map(Number).filter(Boolean).join(',')
      : String(body.channel_ids || '')
  }
}

// 新建
routes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const d = normalizeBody(body)
  if (!d.name) return c.json({ error: '请填写名称' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.target_date)) {
    return c.json({ error: '请选择有效的到期日期' }, 400)
  }
  const now = Math.floor(Date.now() / 1000)
  let lunarMonth = null
  let lunarDay = null
  if (d.is_lunar) {
    const l = solar2lunar(...d.target_date.split('-').map(Number))
    lunarMonth = l.lMonth
    lunarDay = l.lDay
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO subscriptions
      (name, remark, renew_link, type, is_lunar, target_date,
       period_value, period_unit, lunar_month, lunar_day, remind_days,
       remind_time, renew_offset_days, enabled, auto_renew, channel_ids, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      d.name, d.remark, d.renew_link, d.type, d.is_lunar, d.target_date,
      d.period_value, d.period_unit, lunarMonth, lunarDay, d.remind_days,
      d.remind_time, d.renew_offset_days, d.enabled, d.auto_renew, d.channel_ids, now
    )
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

// 更新
routes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM subscriptions WHERE id = ?').bind(id).first()
  if (!exists) return c.json({ error: '订阅不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const d = normalizeBody(body)
  if (!d.name) return c.json({ error: '请填写名称' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.target_date)) {
    return c.json({ error: '请选择有效的到期日期' }, 400)
  }
  let lunarMonth = null
  let lunarDay = null
  if (d.is_lunar) {
    const l = solar2lunar(...d.target_date.split('-').map(Number))
    lunarMonth = l.lMonth
    lunarDay = l.lDay
  }
  await c.env.DB.prepare(
    `UPDATE subscriptions SET
       name=?, remark=?, renew_link=?, type=?, is_lunar=?, target_date=?,
       period_value=?, period_unit=?, lunar_month=?, lunar_day=?, remind_days=?,
       remind_time=?, renew_offset_days=?, enabled=?, auto_renew=?, channel_ids=?, notified_keys=''
     WHERE id=?`
  )
    .bind(
      d.name, d.remark, d.renew_link, d.type, d.is_lunar, d.target_date,
      d.period_value, d.period_unit, lunarMonth, lunarDay, d.remind_days,
      d.remind_time, d.renew_offset_days, d.enabled, d.auto_renew, d.channel_ids, id
    )
    .run()
  return c.json({ ok: true })
})

// 启停
routes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  if (typeof body.enabled === 'boolean') {
    await c.env.DB.prepare('UPDATE subscriptions SET enabled=? WHERE id=?')
      .bind(body.enabled ? 1 : 0, id)
      .run()
  }
  return c.json({ ok: true })
})

// 手动续期：推算到今天之后的下一个到期日
routes.post('/:id/renew', async (c) => {
  const id = Number(c.req.param('id'))
  const sub = await c.env.DB.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first()
  if (!sub) return c.json({ error: '订阅不存在' }, 404)
  const today = toDateStr()
  let target = computeNext(sub)
  while (target <= today) {
    target = computeNext(sub, target)
  }
  await c.env.DB.prepare(
    `UPDATE subscriptions SET target_date=?, last_renew_at=?, pending_renew=0, notified_keys='' WHERE id=?`
  )
    .bind(target, today, id)
    .run()
  return c.json({ ok: true, target_date: target })
})

// 删除
routes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

export default routes
