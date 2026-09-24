// 概览：站点名称、版本、各模块数量

import { Hono } from 'hono'
import { getSettings } from './settings-helper.js'

export const APP_VERSION = 'v1.0.0'

const routes = new Hono()

routes.get('/', async (c) => {
  const settings = await getSettings(c.env.DB)
  const [subs, monitors, bookmarks] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM monitors').first(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM bookmarks').first()
  ])
  return c.json({
    name: settings.title || '超级管家',
    version: APP_VERSION,
    counts: {
      subscriptions: subs.n,
      monitors: monitors.n,
      bookmarks: bookmarks.n
    }
  })
})

export default routes
