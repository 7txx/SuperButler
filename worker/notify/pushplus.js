// PushPlus 推送（https://www.pushplus.plus/）

export async function sendPushPlus(cfg, { title, content }) {
  const body = {
    token: cfg.token,
    title,
    content,
    template: 'html'
  }
  if (cfg.topic) body.topic = cfg.topic
  const r = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  let j
  try {
    j = await r.json()
  } catch {
    throw new Error(`PushPlus 响应异常（HTTP ${r.status}）`)
  }
  if (j.code !== 200) throw new Error(j.msg || `PushPlus 推送失败（code ${j.code}）`)
  return true
}
