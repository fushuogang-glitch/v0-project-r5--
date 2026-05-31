import 'server-only'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

/**
 * 财务 Agent API 鉴权:公司侧的财务 Agent 通过集团级 API Key 调用本接口,
 * 抓取门店财务数据或回填流水。每个集团一把独立密钥,保证多租户隔离。
 */

export type AgentPrincipal = {
  ownerId: string
  name: string
}

/** 从请求头解析并校验 Agent 密钥,返回归属集团;失败返回 null */
export async function authenticateAgent(
  req: Request,
): Promise<AgentPrincipal | null> {
  const auth = req.headers.get('authorization') ?? ''
  const headerKey = req.headers.get('x-agent-key') ?? ''
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  const key = bearer || headerKey
  if (!key || key.length < 16) return null

  const [owner] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.agentApiKey, key))
    .limit(1)

  if (!owner) return null
  return { ownerId: owner.id, name: owner.name }
}

/** 生成一把新的 Agent 密钥(前缀便于识别) */
export function generateAgentKey(): string {
  return `agt_${randomBytes(24).toString('hex')}`
}
