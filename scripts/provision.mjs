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

function findD1Id() {
  try {
    const list = JSON.parse(run('npx wrangler d1 list --json'))
    return list.find((d) => d.name === DB_NAME)?.uuid || ''
  } catch {
    return ''
  }
}

function createD1() {
  const out = run(`npx wrangler d1 create ${DB_NAME}`)
  return out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i)?.[1] || ''
}

function findKvId() {
  try {
    const out = run('npx wrangler kv namespace list --json')
    const list = JSON.parse(out)
    const hit = list.find((k) => k.title === KV_TITLE || k.title === `${DB_NAME}-${KV_TITLE}`)
    return hit?.id || ''
  } catch {
    // 旧版 wrangler 可能不支持 --json，尝试解析表格输出
    try {
      const out = run('npx wrangler kv namespace list')
      const line = out.split('\n').find((l) => l.includes(KV_TITLE))
      return line?.match(/[0-9a-f]{32}/i)?.[0] || ''
    } catch {
      return ''
    }
  }
}

function createKv() {
  const out = run(`npx wrangler kv namespace create ${KV_TITLE}`)
  return out.match(/id\s*=\s*"([0-9a-f]{32})"/i)?.[1] || ''
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
console.log('[provision] 完成')
