// 通知渠道分发：按 channel.type 调用对应实现

import { sendPushPlus } from './pushplus.js'
import { sendSMTP } from './smtp.js'

export const CHANNEL_TYPES = {
  pushplus: {
    label: 'PushPlus',
    desc: '微信推送，pushplus.plus 注册获取 token',
    fields: [
      { key: 'token', label: 'Token', required: true, secret: true, placeholder: 'PushPlus 平台 token' },
      { key: 'topic', label: '群组编码（可选）', required: false }
    ]
  },
  smtp: {
    label: '邮件 SMTP',
    desc: '通过 SMTP 发送邮件（465 端口 SSL），QQ/163 邮箱使用授权码作为密码',
    fields: [
      { key: 'host', label: 'SMTP 服务器', required: true, placeholder: '如 smtp.qq.com / smtp.163.com' },
      { key: 'port', label: '端口', required: false, placeholder: '默认 465' },
      { key: 'username', label: '账号', required: true, placeholder: '发件邮箱完整地址' },
      { key: 'password', label: '密码/授权码', required: true, secret: true },
      { key: 'from', label: '发件地址（可选）', required: false, placeholder: '默认与账号一致' },
      { key: 'from_name', label: '发件人名称（可选）', required: false },
      { key: 'to', label: '收件地址', required: true, placeholder: '接收提醒的邮箱' }
    ]
  }
}

export async function dispatchChannel(channel, message) {
  const cfg = JSON.parse(channel.config || '{}')
  if (channel.type === 'pushplus') return sendPushPlus(cfg, message)
  if (channel.type === 'smtp') return sendSMTP(cfg, message)
  throw new Error(`未知渠道类型：${channel.type}`)
}
