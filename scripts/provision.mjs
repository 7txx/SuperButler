// 自动配置 Cloudflare 资源（D1 / KV）并初始化数据库
// 在 build 阶段执行：wrangler.toml 中的占位符会被替换为真实资源 ID
// 重复执行安全：按名称查找已存在的资源，不会重复创建
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const TOML_PATH = 'wrangler.toml'
const DB_NAME = 'superbutler'
const KV_TITLE = 'KV'
const DB_PLACEHOLDER = '<YOUR_DATABASE_ID>'
const KV_PLACEHOLDER = '<YOUR_KV_NAMESPACE_ID>'

let toml = readFileSync(TOML_PATH, 'utf8')

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// wrangler 可能输出警告等非 JSON 内容，截取第一个 [ 开始的部分再解析
function parseJsonList(out) {
  const i = out.indexOf('[')
  if (i === -1) return []
  return JSON.parse(out.slice(i))
}

// 表格输出兜底：标题按表格单元格精确匹配（避免 KV 误配 lover-KV 之类），同行提取 ID
function matchIdInTable(out, title, idPattern) {
  const cell = new RegExp(`[│|]\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[│|]`)
  const line = out.split('\n').find((l) => cell.test(l) && idPattern.test(l))
  return line?.match(idPattern)?.[0] || ''
}

// 可接受的 KV 命名空间标题（含一键部署向导可能使用的名称）
const KV_TITLES = [KV_TITLE, `${DB_NAME}-${KV_TITLE}`, DB_NAME]
const KV_ID_RE = /[0-9a-f]{32}/i
const D1_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function findD1Id() {
  try {
    const out = run('npx wrangler d1 list')
    const fromJson = parseJsonList(out).find((d) => d.name === DB_NAME)?.uuid
    if (fromJson) return fromJson
    return matchIdInTable(out, DB_NAME, D1_ID_RE)
  } catch {
    return ''
  }
}

function createD1() {
  try {
    const out = run(`npx wrangler d1 create ${DB_NAME}`)
    const id =
      out.match(/database_id["']?\s*[:=]\s*"([0-9a-f-]{36})"/i)?.[1] ||
      out.match(D1_ID_RE)?.[0]
    if (id) return id
  } catch {
    // 可能同名数据库已存在，回退到列表查找
  }
  return findD1Id()
}

function findKvId() {
  try {
    const out = run('npx wrangler kv namespace list')
    const fromJson = parseJsonList(out).find((k) => KV_TITLES.includes(k.title))?.id
    if (fromJson) return fromJson
    for (const title of KV_TITLES) {
      const id = matchIdInTable(out, title, KV_ID_RE)
      if (id) return id
    }
    return ''
  } catch {
    return ''
  }
}

function createKv() {
  try {
    const out = run(`npx wrangler kv namespace create ${KV_TITLE}`)
    const id =
      out.match(/"id"\s*:\s*"([0-9a-f]{32})"/i)?.[1] ||
      out.match(/id\s*=\s*"([0-9a-f]{32})"/i)?.[1] ||
      out.match(KV_ID_RE)?.[0]
    if (id) return id
  } catch {
    // 同名命名空间已存在，回退到列表查找
  }
  return findKvId()
}

// 1. D1
if (toml.includes(DB_PLACEHOLDER)) {
  console.log('[provision] 检查 D1 数据库...')
  const id = findD1Id() || createD1()
  if (!id) throw new Error('[provision] 无法获取 D1 database_id')
  toml = toml.replace(DB_PLACEHOLDER, id)
  console.log(`[provision] D1 database_id = ${id}`)
}

// 2. KV
if (toml.includes(KV_PLACEHOLDER)) {
  console.log('[provision] 检查 KV 命名空间...')
  const id = findKvId() || createKv()
  if (!id) throw new Error('[provision] 无法获取 KV namespace id')
  toml = toml.replace(KV_PLACEHOLDER, id)
  console.log(`[provision] KV namespace id = ${id}`)
}

writeFileSync(TOML_PATH, toml)

// 3. 初始化数据库表与默认数据（schema.sql 幂等，可重复执行）
console.log('[provision] 初始化数据库...')
execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=./schema.sql`, {
  stdio: 'inherit'
})

// 4. 老库迁移：subscriptions 补充新列 / 统一类型
// SQLite 不支持 ADD COLUMN IF NOT EXISTS，列已存在时报错忽略即可
const migrations = [
  `ALTER TABLE subscriptions ADD COLUMN remind_time TEXT NOT NULL DEFAULT '08:00'`,
  `ALTER TABLE subscriptions ADD COLUMN renew_offset_days INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE subscriptions ADD COLUMN renew_link TEXT NOT NULL DEFAULT ''`,
  `UPDATE subscriptions SET type='cycle' WHERE type<>'cycle'`
]
for (const sql of migrations) {
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${sql}"`, {
      stdio: 'inherit'
    })
  } catch {
    console.log(`[provision] 迁移跳过（可能已执行过）: ${sql.slice(0, 60)}...`)
  }
}
console.log('[provision] 完成')
