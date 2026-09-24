// ============================================================
// SMTP 邮件发送（465 隐式 TLS / 587 STARTTLS）
// 通过 cloudflare:sockets 直连，兼容 QQ/163/Gmail 等
// ============================================================

import { connect } from 'cloudflare:sockets'

function b64Text(s) {
  // UTF-8 -> base64
  return btoa(String(s).replace(/[-￿]/g, (ch) => {
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

  const useStarttls = port === 587
  let socket = connect({
    hostname: host,
    port,
    secureTransport: useStarttls ? 'starttls' : 'on'
  })
  let writer = socket.writable.getWriter()
  let reader = socket.readable.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let stage = '初始化'

  async function readResponse(expected) {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`SMTP 连接在「${stage}」阶段被服务器关闭`)
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
        throw new Error(`SMTP「${stage}」响应 ${finalLine}（期望 ${expected}）`)
      }
      return finalLine
    }
  }

  async function send(cmd) {
    await writer.write(new TextEncoder().encode(cmd))
  }

  async function ehlo() {
    await send('EHLO lover\r\n')
    await readResponse(250)
  }

  try {
    stage = '等待问候'
    await readResponse(220)
    stage = 'EHLO'
    await ehlo()

    if (useStarttls) {
      stage = 'STARTTLS'
      await send('STARTTLS\r\n')
      await readResponse(220)
      // 升级 TLS：释放旧流锁，换新 socket 的读写流
      try { reader.releaseLock() } catch {}
      try { writer.releaseLock() } catch {}
      socket = socket.startTls()
      writer = socket.writable.getWriter()
      reader = socket.readable.getReader()
      buffer = ''
      stage = 'EHLO(TLS)'
      await ehlo()
    }

    stage = '认证'
    await send('AUTH LOGIN\r\n')
    await readResponse(334)
    await send(`${b64Text(username)}\r\n`)
    await readResponse(334)
    await send(`${b64Text(password)}\r\n`)
    await readResponse(235)

    stage = '发件人'
    await send(`MAIL FROM:<${from}>\r\n`)
    await readResponse(250)
    stage = '收件人'
    await send(`RCPT TO:<${to}>\r\n`)
    await readResponse(250)
    stage = '正文'
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
    stage = '发送确认'
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
