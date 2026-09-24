// 站点设置公共读取

export const SETTING_DEFAULTS = {
  title: '超级管家',
  subtitle: '',
  description: '',
  language: 'zh-CN',
  domain: '',
  logo_version: '0'
}

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all()
  const out = { ...SETTING_DEFAULTS }
  for (const r of results) out[r.key] = r.value
  return out
}

export async function saveSettings(db, patch) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2'
  )
  for (const [k, v] of Object.entries(patch)) {
    await stmt.bind(k, String(v ?? '')).run()
  }
}
