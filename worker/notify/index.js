// 通知渠道分发：按 channel.type 调用对应实现

import { sendPushPlus } from './pushplus.js'

export const CHANNEL_TYPES = {
  pushplus: {
    label: 'PushPlus',
    desc: '微信推送，pushplus.plus 注册获取 token',
    fields: [
      { key: 'token', label: 'Token', required: true, placeholder: 'PushPlus 平台 token' },
      { key: 'topic', label: '群组编码（可选）', required: false }
    ]
  },
  resend: {
    label: 'Resend（邮件）',
    desc: 'resend.com 注册获取 API Key，免费额度每天 100 封；未绑域名时发件人填 onboarding@resend.dev',
    fields: [
      { key: 'api_key', label: 'API Key', required: true, placeholder: 're_xxxxxxxxx' },
      { key: 'from', label: '发件人', required: true, placeholder: '未绑域名填 onboarding@resend.dev' },
      { key: 'to', label: '收件人', required: true, placeholder: '接收提醒的邮箱' }
    ]
  }
}

export async function dispatchChannel(channel, message) {
  const cfg = JSON.parse(channel.config || '{}')
  if (channel.type === 'pushplus') return sendPushPlus(cfg, message)
  if (channel.type === 'resend') return sendResend(cfg, message)
  throw new Error(`未知渠道类型：${channel.type}`)
}

// Resend HTTPS API（不受 SMTP 端口/IP 封锁影响）
async function sendResend(cfg, { title, content }) {
  const apiKey = String(cfg.api_key || '').trim()
  const from = String(cfg.from || '').trim()
  const to = String(cfg.to || '').trim()
  if (!apiKey || !from || !to) {
    throw new Error('Resend 配置不完整（需要 api_key/from/to）')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject: title, html: content })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Resend 发送失败：${data.message || res.status}`)
  }
  return true
}
