// 前台公开接口：设置 / 分类树 / 分类书签 / 搜索引擎

import { Hono } from 'hono'
import { getSettings } from './settings-helper.js'

const routes = new Hono()

// 站点信息
routes.get('/site', async (c) => {
  const s = await getSettings(c.env.DB)
  return c.json({
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    language: s.language,
    logo_version: s.logo_version
  })
})

// 导航全量数据（首页一次拉取）
routes.get('/nav', async (c) => {
  const [categories, bookmarks, engines] = await Promise.all([
    c.env.DB.prepare('SELECT id,name,parent_id,sort_order,is_default FROM categories ORDER BY sort_order ASC, id ASC').all(),
    c.env.DB.prepare('SELECT id,category_id,name,url,description,icon,sort_order FROM bookmarks ORDER BY sort_order ASC, id ASC').all(),
    c.env.DB.prepare('SELECT id,name,url_template,icon,sort_order,is_internal FROM search_engines WHERE is_active=1 ORDER BY sort_order ASC, id ASC').all()
  ])
  return c.json({
    categories: categories.results.map((r) => ({ ...r, is_default: !!r.is_default })),
    bookmarks: bookmarks.results,
    engines: engines.results.map((r) => ({ ...r, is_internal: !!r.is_internal }))
  })
})

// 单个分类（含子分类）书签
routes.get('/bookmarks', async (c) => {
  const categoryId = parseInt(c.req.query('category_id'), 10)
  if (!categoryId) return c.json({ bookmarks: [] })
  // 递归收集子分类 id
  const { results: allCats } = await c.env.DB.prepare('SELECT id, parent_id FROM categories').all()
  const ids = new Set([categoryId])
  let changed = true
  while (changed) {
    changed = false
    for (const cat of allCats) {
      if (ids.has(cat.parent_id) && !ids.has(cat.id)) {
        ids.add(cat.id)
        changed = true
      }
    }
  }
  const placeholders = [...ids].map(() => '?').join(',')
  const { results } = await c.env.DB.prepare(
    `SELECT id,category_id,name,url,description,icon,sort_order
     FROM bookmarks WHERE category_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`
  )
    .bind(...ids)
    .all()
  return c.json({ bookmarks: results })
})

export default routes
