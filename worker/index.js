// ============================================================
// SuperButler 超级管家 —— 单 Cloudflare Worker：个人导航 + 订阅提醒 + 网站监控
// Hono 路由 + Static Assets + D1 + KV + Cron
// ============================================================

import { Hono } from 'hono'
import { requireAdmin } from './lib/auth.js'

import authRoutes from './routes/auth.js'
import publicRoutes from './routes/public.js'
import overviewRoutes from './routes/overview.js'
import subsRoutes from './routes/subscriptions.js'
import monitorsRoutes from './routes/monitors.js'
import navRoutes from './routes/nav.js'
import channelsRoutes from './routes/channels.js'
import settingsRoutes from './routes/settings.js'
import accountRoutes from './routes/account.js'
import { runMonitors, runSubscriptions } from './jobs/cron.js'
import cronJob from './jobs/cron.js'

const app = new Hono()

app.onError((err, c) => {
  console.error('worker error:', err)
  return c.json({ error: err.message || '服务器内部错误' }, 500)
})

// ---------------- 公开接口 ----------------

app.route('/api/auth', authRoutes)
app.route('/api/public', publicRoutes)

// Logo（存于 KV，公开访问）
app.get('/api/public/logo', async (c) => {
  const obj = await c.env.KV.getWithMetadata('site:logo', 'arrayBuffer')
  if (!obj.value) return c.body(null, 204)
  return c.body(obj.value, 200, {
    'Content-Type': (obj.metadata && obj.metadata.type) || 'image/png',
    'Cache-Control': 'public, max-age=86400'
  })
})

// ---------------- 管理接口（需登录） ----------------

const admin = new Hono()
admin.use('*', requireAdmin)
admin.route('/overview', overviewRoutes)
admin.route('/subscriptions', subsRoutes)
admin.route('/monitors', monitorsRoutes)
admin.route('/nav', navRoutes)
admin.route('/channels', channelsRoutes)
admin.route('/settings', settingsRoutes)
admin.route('/account', accountRoutes)

// 手动触发定时任务（调试用）
admin.post('/system/run-cron', async (c) => {
  const [monitors, subs] = await Promise.all([runMonitors(c.env), runSubscriptions(c.env)])
  return c.json({ ok: true, monitors, subs })
})

app.route('/api/admin', admin)

// ---------------- 前端静态资源（SPA） ----------------

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default {
  fetch: app.fetch,
  scheduled: cronJob.scheduled
}
