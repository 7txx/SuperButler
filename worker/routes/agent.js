// 服务器 Agent 上报接口（公开访问，用每台服务器独立的 agent_token 鉴权）

import { Hono } from 'hono'

const routes = new Hono()

function toNum(v, def = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function toInt(v, def = 0) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(0, n) : def
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// POST /api/agent/report
routes.post('/report', async (c) => {
  const token = String(c.req.header('X-Agent-Token') || '').trim()
  if (!token) return c.json({ error: '缺少 Agent Token' }, 401)

  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE agent_token=?')
    .bind(token)
    .first()
  if (!server) return c.json({ error: 'Agent Token 无效' }, 401)

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: '数据格式错误' }, 400)

  const now = Math.floor(Date.now() / 1000)
  const mem = body.mem || {}
  const swap = body.swap || {}
  const disk = body.disk || {}
  const net = body.net || {}
  const load = Array.isArray(body.load) ? body.load : []

  const agentVersion = String(body.agent_version || '').slice(0, 40)
  const os = String(body.os || '').slice(0, 120)
  const arch = String(body.arch || '').slice(0, 40)
  const uptime = body.uptime == null ? null : toInt(body.uptime, 0)
  const temp = body.temp == null || body.temp === '' ? null : toNum(body.temp, 0)

  const cpu = clamp(toNum(body.cpu, 0), 0, 100)
  const memUsed = toInt(mem.used, 0)
  const memTotal = toInt(mem.total, 0)
  const swapUsed = toInt(swap.used, 0)
  const swapTotal = toInt(swap.total, 0)
  const diskUsed = toInt(disk.used, 0)
  const diskTotal = toInt(disk.total, 0)
  const load1 = toNum(load[0], 0)
  const load5 = toNum(load[1], 0)
  const load15 = toNum(load[2], 0)
  const netRx = toInt(net.rx, 0)
  const netTx = toInt(net.tx, 0)
  const trafficUp = toInt(net.month_tx, 0)
  const trafficDown = toInt(net.month_rx, 0)
  const processes = body.processes == null ? null : toInt(body.processes, 0)
  const tcpConn = body.tcp == null ? null : toInt(body.tcp, 0)
  const udpConn = body.udp == null ? null : toInt(body.udp, 0)

  await c.env.DB.prepare(
    `INSERT INTO server_metrics
       (server_id, ts, cpu, mem_used, mem_total, swap_used, swap_total,
        disk_used, disk_total, load1, load5, load15, net_rx, net_tx,
        traffic_up, traffic_down, temp, processes, tcp_conn, udp_conn, uptime_seconds)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      server.id,
      now,
      cpu,
      memUsed,
      memTotal,
      swapUsed,
      swapTotal,
      diskUsed,
      diskTotal,
      load1,
      load5,
      load15,
      netRx,
      netTx,
      trafficUp,
      trafficDown,
      temp,
      processes,
      tcpConn,
      udpConn,
      uptime
    )
    .run()

  await c.env.DB.prepare(
    `UPDATE servers
        SET status='online', last_seen=?, agent_version=?, os=?, arch=?, uptime_seconds=?
      WHERE id=?`
  )
    .bind(now, agentVersion, os, arch, uptime, server.id)
    .run()

  return c.json({ ok: true, server: server.name, ts: now })
})

export default routes
