// 平台告警通知接口(预留)
// 当前实现为占位:仅记录日志,不真实发送。
// 后续可在此对接短信 / 企业微信 / 邮件 webhook —— 上层调用方无需改动。

export type PlatformNotice = {
  title: string
  body: string
  channel?: 'sms' | 'wecom' | 'email' | 'webhook'
}

export async function notifyPlatform(notice: PlatformNotice): Promise<{ delivered: boolean }> {
  // 预留:读取环境变量中的 webhook 地址并发送。未配置则跳过。
  const webhook = process.env.PLATFORM_ALERT_WEBHOOK
  if (!webhook) {
    console.log('[v0] 平台通知(未配置渠道,跳过):', notice.title)
    return { delivered: false }
  }
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: notice.title, body: notice.body, channel: notice.channel ?? 'webhook' }),
    })
    return { delivered: true }
  } catch (e) {
    console.log('[v0] 平台通知发送失败:', (e as Error).message)
    return { delivered: false }
  }
}
