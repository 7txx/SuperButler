// 系统设置：基本信息 / Logo / 备份恢复

import { Hono } from 'hono'
import { getSettings, saveSettings } from './settings-helper.js'

const routes = new Hono()

// 读取全部设置
routes.get('/', async (c) => {
  return c.json(await getSettings(c.env.DB))
})

// 保存基本信息
routes.put('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const patch = {}
  for (const k of ['title', 'subtitle', 'description', 'language', 'domain']) {
    if (body[k] !== undefined) patch[k] = String(body[k]).trim()
  }
  if (!patch.title) patch.title = '个人导航'
  await saveSettings(c.env.DB, patch)
  return c.json({ ok: true })
})

// Logo 上传：接收 {data: 'data:image/png;base64,...'}，存 KV
routes.put('/logo', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dataUrl = String(body.data || '')
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/)
  if (!m) return c.json({ error: '请上传 PNG/JPG/WebP/SVG 格式图片' }, 400)
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0))
  if (bytes.length > 1024 * 1024) return c.json({ error: 'Logo 不能超过 1MB' }, 400)
  await c.env.KV.put('site:logo', bytes, { metadata: { type: m[1] } })
  await saveSettings(c.env.DB, { logo_version: String(Date.now()) })
  return c.json({ ok: true })
})

routes.delete('/logo', async (c) => {
  await c.env.KV.delete('site:logo')
  await saveSettings(c.env.DB, { logo_version: String(Date.now()) })
  return c.json({ ok: true })
})

// 导出备份（不含管理员账号）
routes.get('/backup', async (c) => {
  const tables = [
    'settings',
    'categories',
    'bookmarks',
    'search_engines',
    'channels',
    'subscriptions',
    'monitors'
  ]
  const data = { _backup: 'lover', _version: 1, exported_at: new Date().toISOString() }
  for (const t of tables) {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${t}`).all()
    data[t] = results
  }
  return c.json(data)
})

// 导入备份（覆盖式）
routes.post('/restore', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || body._backup !== 'lover') {
    return c.json({ error: '备份文件格式不正确' }, 400)
  }
  const tables = [
    'monitors',
    'subscriptions',
    'channels',
    'search_engines',
    'bookmarks',
    'categories',
    'settings'
  ]
  const db = c.env.DB
  for (const t of tables) {
    if (!Array.isArray(body[t])) continue
    await db.prepare(`DELETE FROM ${t}`).run()
  }
  // settings
  for (const r of body.settings || []) {
    await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)')
      .bind(r.key, r.value)
      .run()
  }
  // categories
  for (const r of body.categories || []) {
    await db.prepare(
      'INSERT INTO categories (id,name,parent_id,sort_order,is_default,created_at) VALUES (?,?,?,?,?,?)'
    )
      .bind(r.id, r.name, r.parent_id, r.sort_order, r.is_default, r.created_at)
      .run()
  }
  // bookmarks
  for (const r of body.bookmarks || []) {
    await db.prepare(
      'INSERT INTO bookmarks (id,category_id,name,url,description,icon,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?)'
    )
      .bind(r.id, r.category_id, r.name, r.url, r.description, r.icon, r.sort_order, r.created_at)
      .run()
  }
  // search engines
  for (const r of body.search_engines || []) {
    await db.prepare(
      'INSERT INTO search_engines (id,name,url_template,icon,sort_order,is_active,is_internal) VALUES (?,?,?,?,?,?,?)'
    )
      .bind(r.id, r.name, r.url_template, r.icon, r.sort_order, r.is_active, r.is_internal)
      .run()
  }
  // channels
  for (const r of body.channels || []) {
    await db.prepare(
      'INSERT INTO channels (id,name,type,config,enabled,created_at) VALUES (?,?,?,?,?,?)'
    )
      .bind(r.id, r.name, r.type, r.config, r.enabled, r.created_at)
      .run()
  }
  // subscriptions
  for (const r of body.subscriptions || []) {
    await db.prepare(
      `INSERT INTO subscriptions
        (id,name,remark,tags,amount,currency,type,is_lunar,target_date,period_value,period_unit,
         lunar_month,lunar_day,remind_days,enabled,auto_renew,pending_renew,last_renew_at,
         notified_keys,channel_ids,sort_order,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        r.id, r.name, r.remark, r.tags, r.amount, r.currency, r.type, r.is_lunar, r.target_date,
        r.period_value, r.period_unit, r.lunar_month, r.lunar_day, r.remind_days, r.enabled,
        r.auto_renew, r.pending_renew, r.last_renew_at, r.notified_keys, r.channel_ids,
        r.sort_order, r.created_at
      )
      .run()
  }
  // monitors
  for (const r of body.monitors || []) {
    await db.prepare(
      `INSERT INTO monitors
        (id,name,url,interval_seconds,enabled,hidden,status,status_code,last_checked_at,
         last_error,sort_order,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        r.id, r.name, r.url, r.interval_seconds, r.enabled, r.hidden, r.status, r.status_code,
        r.last_checked_at, r.last_error, r.sort_order, r.created_at
      )
      .run()
  }
  return c.json({ ok: true })
})

export default routes
