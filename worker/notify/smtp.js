// ============================================================
// SMTP 邮件发送（隐式 TLS，端口 465）
// 通过 cloudflare:sockets 直连，兼容 QQ/163/Gmail 等
// ============================================================

import { connect } from 'cloudflare:sockets'

function b64Text(s) {
  // UTF-8 -> base64
  return btoa(String(s).replace(/[\u0080-\uFFFF]/g, (ch) => {
    const c = ch.charCodeAt(0)
    if (c < 0x800) return String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    return String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }))
}

export async function sendSMTP(cfg, { title, content }) {
  const host = String(cfg.host || '').trim()
  const port = Number(cfg.port || 465)
  const username = String(cfg.username || '').trim()
  const password = String(cfg.password || '')
  const from = String(cfg.from || username).trim()
  const to = String(cfg.to || '').trim()
  if (!host || !username || !password || !to) {
    throw new Error('SMTP 配置不完整（需要 host/username/password/to）')
  }

  const socket = connect({ hostname: host, port, secureTransport: 'on' })
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  async function readResponse(expected) {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('SMTP 连接意外关闭')
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\r\n')
      buffer = lines.pop()
      // SMTP 多行回复：NNN- 为续行，NNN␣ 为结束行；必须读到结束行才算完整，
      // 否则残留的续行会污染下一条命令的响应解析
      let finalLine = ''
      for (const line of lines) {
        const m = line.match(/^(\d{3})([ -])/)
        if (m && m[2] === ' ') finalLine = line
      }
      if (!finalLine) continue
      const code = parseInt(finalLine.slice(0, 3), 10)
      if (code !== expected) {
        throw new Error(`SMTP 响应 ${finalLine}（期望 ${expected}）`)
      }
      return finalLine
    }
  }

  async function send(cmd) {
    await writer.write(new TextEncoder().encode(cmd))
  }

  try {
    await readResponse(220)
    await send('EHLO lover\r\n')
    await readResponse(250)
    await send('AUTH LOGIN\r\n')
    await readResponse(334)
    await send(`${b64Text(username)}\r\n`)
    await readResponse(334)
    await send(`${b64Text(password)}\r\n`)
    await readResponse(235)
    await send(`MAIL FROM:<${from}>\r\n`)
    await readResponse(250)
    await send(`RCPT TO:<${to}>\r\n`)
    await readResponse(250)
    await send('DATA\r\n')
    await readResponse(354)

    const body = [
      `From: =?UTF-8?B?${b64Text(cfg.from_name || 'SuperButler')}?= <${from}>`,
      `To: <${to}>`,
      `Subject: =?UTF-8?B?${b64Text(title)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64Text(content),
      '.',
      ''
    ].join('\r\n')
    await send(body)
    await readResponse(250)
    await send('QUIT\r\n')
  } finally {
    try {
      await writer.close()
    } catch {}
    try {
      await reader.cancel()
    } catch {}
    try {
      socket.close()
    } catch {}
  }
  return true
}
