// 导航后台：分类 / 书签 / 搜索引擎 管理

import { Hono } from 'hono'
import { normalizeUrl } from '../lib/dateutil.js'

const routes = new Hono()

// ---------------- 分类 ----------------

routes.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
  ).all()
  return c.json(results.map((r) => ({ ...r, is_default: !!r.is_default })))
})

routes.post('/categories', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return c.json({ error: '请填写分类名称' }, 400)
  const parentId = Math.max(0, parseInt(body.parent_id, 10) || 0)
  const sortOrder = parseInt(body.sort_order, 10) || 0
  const isDefault = body.is_default ? 1 : 0
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    'INSERT INTO categories (name, parent_id, sort_order, is_default, created_at) VALUES (?,?,?,?,?)'
  )
    .bind(name, parentId, sortOrder, isDefault, now)
    .run()
  if (isDefault) {
    await c.env.DB.prepare('UPDATE categories SET is_default=0 WHERE id<>?')
      .bind(result.meta.last_row_id)
      .run()
  }
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.put('/categories/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '分类不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return c.json({ error: '请填写分类名称' }, 400)
  const parentId = Math.max(0, parseInt(body.parent_id, 10) || 0)
  if (parentId === id) return c.json({ error: '上级分类不能选择自己' }, 400)
  const sortOrder = parseInt(body.sort_order, 10) || 0
  const isDefault = body.is_default ? 1 : 0
  await c.env.DB.prepare(
    'UPDATE categories SET name=?, parent_id=?, sort_order=?, is_default=? WHERE id=?'
  )
    .bind(name, parentId, sortOrder, isDefault, id)
    .run()
  if (isDefault) {
    await c.env.DB.prepare('UPDATE categories SET is_default=0 WHERE id<>?').bind(id).run()
  }
  return c.json({ ok: true })
})

routes.delete('/categories/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const children = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM categories WHERE parent_id=?'
  )
    .bind(id)
    .first()
  if (children.n > 0) return c.json({ error: '请先删除或移动其子分类' }, 400)
  const links = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM bookmarks WHERE category_id=?'
  )
    .bind(id)
    .first()
  if (links.n > 0) return c.json({ error: '请先删除或移动该分类下的网站' }, 400)
  await c.env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

// ---------------- 书签 ----------------

routes.get('/bookmarks', async (c) => {
  const categoryId = parseInt(c.req.query('category_id'), 10)
  let sql = 'SELECT * FROM bookmarks'
  const binds = []
  if (categoryId) {
    sql += ' WHERE category_id=?'
    binds.push(categoryId)
  }
  sql += ' ORDER BY sort_order ASC, id ASC'
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results)
})

routes.post('/bookmarks', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const categoryId = parseInt(body.category_id, 10)
  const url = normalizeUrl(body.url)
  if (!name) return c.json({ error: '请填写名称' }, 400)
  if (!categoryId) return c.json({ error: '请选择分类' }, 400)
  if (!url) return c.json({ error: '请填写有效的网址' }, 400)
  const now = Math.floor(Date.now() / 1000)
  const result = await c.env.DB.prepare(
    `INSERT INTO bookmarks (category_id, name, url, description, icon, sort_order, created_at)
     VALUES (?,?,?,?,?,?,?)`
  )
    .bind(
      categoryId, name, url,
      String(body.description || '').trim(),
      String(body.icon || '').trim(),
      parseInt(body.sort_order, 10) || 0,
      now
    )
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.put('/bookmarks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM bookmarks WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '网站不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const categoryId = parseInt(body.category_id, 10)
  const url = normalizeUrl(body.url)
  if (!name) return c.json({ error: '请填写名称' }, 400)
  if (!categoryId) return c.json({ error: '请选择分类' }, 400)
  if (!url) return c.json({ error: '请填写有效的网址' }, 400)
  await c.env.DB.prepare(
    `UPDATE bookmarks SET category_id=?, name=?, url=?, description=?, icon=?, sort_order=? WHERE id=?`
  )
    .bind(
      categoryId, name, url,
      String(body.description || '').trim(),
      String(body.icon || '').trim(),
      parseInt(body.sort_order, 10) || 0,
      id
    )
    .run()
  return c.json({ ok: true })
})

routes.delete('/bookmarks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM bookmarks WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

// ---------------- 搜索引擎 ----------------

routes.get('/engines', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM search_engines ORDER BY sort_order ASC, id ASC'
  ).all()
  return c.json(results.map((r) => ({ ...r, is_active: !!r.is_active, is_internal: !!r.is_internal })))
})

routes.post('/engines', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const tpl = String(body.url_template || '').trim()
  if (!name) return c.json({ error: '请填写引擎名称' }, 400)
  const isInternal = body.is_internal ? 1 : 0
  if (!isInternal && !tpl.includes('{q}')) {
    return c.json({ error: '搜索地址需包含 {q} 占位符' }, 400)
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO search_engines (name, url_template, icon, sort_order, is_active, is_internal)
     VALUES (?,?,?,?,?,?)`
  )
    .bind(
      name, isInternal ? '' : tpl,
      String(body.icon || '').trim(),
      parseInt(body.sort_order, 10) || 0,
      body.is_active === false ? 0 : 1,
      isInternal
    )
    .run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

routes.put('/engines/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const exists = await c.env.DB.prepare('SELECT id FROM search_engines WHERE id=?').bind(id).first()
  if (!exists) return c.json({ error: '引擎不存在' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const tpl = String(body.url_template || '').trim()
  if (!name) return c.json({ error: '请填写引擎名称' }, 400)
  const isInternal = body.is_internal ? 1 : 0
  if (!isInternal && !tpl.includes('{q}')) {
    return c.json({ error: '搜索地址需包含 {q} 占位符' }, 400)
  }
  await c.env.DB.prepare(
    `UPDATE search_engines SET name=?, url_template=?, icon=?, sort_order=?, is_active=?, is_internal=? WHERE id=?`
  )
    .bind(
      name, isInternal ? '' : tpl,
      String(body.icon || '').trim(),
      parseInt(body.sort_order, 10) || 0,
      body.is_active === false ? 0 : 1,
      isInternal,
      id
    )
    .run()
  return c.json({ ok: true })
})

routes.delete('/engines/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const engine = await c.env.DB.prepare('SELECT is_internal FROM search_engines WHERE id=?')
    .bind(id)
    .first()
  if (engine && engine.is_internal) return c.json({ error: '站内搜索引擎不可删除' }, 400)
  await c.env.DB.prepare('DELETE FROM search_engines WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

export default routes
