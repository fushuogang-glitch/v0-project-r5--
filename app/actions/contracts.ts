'use server'

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import {
  contracts,
  contractAttachments,
  contractSignatures,
  entities,
  transactions,
} from '@/lib/db/schema'
import { getScope, type Scope } from '@/lib/scope'
import { and, eq, sql, desc, inArray, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// 范围助手:合同同样按 ownerId 隔离;scope 锁定主体时再按 entityId 过滤
// ---------------------------------------------------------------------------
function contractWhere(scope: Scope, extra: SQL[] = []) {
  const conds: SQL[] = [eq(contracts.userId, scope.ownerId), ...extra]
  if (scope.entityId != null) conds.push(eq(contracts.entityId, scope.entityId))
  return and(...conds)
}

/** 校验主体归属;门店端只能操作自己的主体 */
async function assertEntityAccess(scope: Scope, entityId: number) {
  if (scope.role === 'store' && scope.entityId !== entityId) {
    throw new Error('无权访问该主体')
  }
  const [e] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!e) throw new Error('主体不存在')
}

/** 取一份合同并校验归属 */
async function getOwnedContract(scope: Scope, id: number) {
  const [c] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.userId, scope.ownerId)))
    .limit(1)
  if (!c) throw new Error('合同不存在')
  if (scope.role === 'store' && scope.entityId !== c.entityId) {
    throw new Error('无权访问该合同')
  }
  return c
}

// 合同关键信息哈希:用于签署留痕(防篡改)
function contractHash(c: {
  contractNo: string
  title: string
  counterparty: string
  amount: string | number
  entityId: number
}) {
  const payload = `${c.contractNo}|${c.title}|${c.counterparty}|${c.amount}|${c.entityId}`
  return createHash('sha256').update(payload).digest('hex')
}

// ---------------------------------------------------------------------------
// 列表
// ---------------------------------------------------------------------------
export type ContractListItem = {
  id: number
  contractNo: string
  title: string
  counterparty: string
  category: string
  direction: string
  amount: number
  status: string
  signDate: string | null
  startDate: string | null
  endDate: string | null
  entityId: number
  entityName: string
  attachmentCount: number
  signatureCount: number
  linkedCount: number // 已挂接流水笔数
  linkedAmount: number // 已挂接进账金额
}

export async function getContracts(): Promise<ContractListItem[]> {
  const scope = await getScope()

  const rows = await db
    .select({
      id: contracts.id,
      contractNo: contracts.contractNo,
      title: contracts.title,
      counterparty: contracts.counterparty,
      category: contracts.category,
      direction: contracts.direction,
      amount: contracts.amount,
      status: contracts.status,
      signDate: contracts.signDate,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      entityId: contracts.entityId,
      entityName: entities.name,
    })
    .from(contracts)
    .leftJoin(entities, eq(entities.id, contracts.entityId))
    .where(contractWhere(scope))
    .orderBy(desc(contracts.signDate), desc(contracts.id))

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)

  // 附件数
  const attCounts = await db
    .select({ contractId: contractAttachments.contractId, n: sql<string>`count(*)` })
    .from(contractAttachments)
    .where(
      and(
        eq(contractAttachments.userId, scope.ownerId),
        inArray(contractAttachments.contractId, ids),
      ),
    )
    .groupBy(contractAttachments.contractId)
  const attMap = new Map(attCounts.map((a) => [a.contractId, Number(a.n)]))

  // 签署数
  const sigCounts = await db
    .select({ contractId: contractSignatures.contractId, n: sql<string>`count(*)` })
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.userId, scope.ownerId),
        inArray(contractSignatures.contractId, ids),
      ),
    )
    .groupBy(contractSignatures.contractId)
  const sigMap = new Map(sigCounts.map((a) => [a.contractId, Number(a.n)]))

  // 已挂接流水(笔数 + 金额)
  const linked = await db
    .select({
      contractId: transactions.contractId,
      n: sql<string>`count(*)`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        inArray(transactions.contractId, ids),
      ),
    )
    .groupBy(transactions.contractId)
  const linkedMap = new Map(
    linked.map((l) => [l.contractId as number, { n: Number(l.n), total: Number(l.total) }]),
  )

  return rows.map((r) => ({
    id: r.id,
    contractNo: r.contractNo,
    title: r.title,
    counterparty: r.counterparty,
    category: r.category,
    direction: r.direction,
    amount: Number(r.amount),
    status: r.status,
    signDate: r.signDate,
    startDate: r.startDate,
    endDate: r.endDate,
    entityId: r.entityId,
    entityName: r.entityName ?? '—',
    attachmentCount: attMap.get(r.id) ?? 0,
    signatureCount: sigMap.get(r.id) ?? 0,
    linkedCount: linkedMap.get(r.id)?.n ?? 0,
    linkedAmount: linkedMap.get(r.id)?.total ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// 详情
// ---------------------------------------------------------------------------
export type ContractDetail = {
  contract: {
    id: number
    contractNo: string
    title: string
    counterparty: string
    counterpartyContact: string | null
    counterpartyPhone: string | null
    category: string
    direction: string
    amount: number
    signDate: string | null
    startDate: string | null
    endDate: string | null
    status: string
    summary: string | null
    entityId: number
    entityName: string
  }
  attachments: {
    id: number
    fileName: string
    mimeType: string
    fileSize: number
    dataUrl: string
    createdAt: string
  }[]
  signatures: {
    id: number
    party: string
    signerName: string
    signatureData: string
    contractHash: string | null
    signedAt: string
  }[]
  linkedTransactions: {
    id: number
    bizDate: string
    summary: string | null
    category: string
    channel: string
    amount: number
  }[]
}

export async function getContractDetail(id: number): Promise<ContractDetail> {
  const scope = await getScope()
  const c = await getOwnedContract(scope, id)

  const [ent] = await db
    .select({ name: entities.name })
    .from(entities)
    .where(eq(entities.id, c.entityId))
    .limit(1)

  const atts = await db
    .select()
    .from(contractAttachments)
    .where(
      and(
        eq(contractAttachments.userId, scope.ownerId),
        eq(contractAttachments.contractId, id),
      ),
    )
    .orderBy(desc(contractAttachments.id))

  const sigs = await db
    .select()
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.userId, scope.ownerId),
        eq(contractSignatures.contractId, id),
      ),
    )
    .orderBy(contractSignatures.signedAt)

  const txns = await db
    .select({
      id: transactions.id,
      bizDate: transactions.bizDate,
      summary: transactions.summary,
      category: transactions.category,
      channel: transactions.channel,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, scope.ownerId), eq(transactions.contractId, id)),
    )
    .orderBy(desc(transactions.bizDate))

  return {
    contract: {
      id: c.id,
      contractNo: c.contractNo,
      title: c.title,
      counterparty: c.counterparty,
      counterpartyContact: c.counterpartyContact,
      counterpartyPhone: c.counterpartyPhone,
      category: c.category,
      direction: c.direction,
      amount: Number(c.amount),
      signDate: c.signDate,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      summary: c.summary,
      entityId: c.entityId,
      entityName: ent?.name ?? '—',
    },
    attachments: atts.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      dataUrl: a.dataUrl,
      createdAt: a.createdAt.toISOString(),
    })),
    signatures: sigs.map((s) => ({
      id: s.id,
      party: s.party,
      signerName: s.signerName,
      signatureData: s.signatureData,
      contractHash: s.contractHash,
      signedAt: s.signedAt.toISOString(),
    })),
    linkedTransactions: txns.map((t) => ({
      id: t.id,
      bizDate: t.bizDate,
      summary: t.summary,
      category: t.category,
      channel: t.channel,
      amount: Number(t.amount),
    })),
  }
}

// ---------------------------------------------------------------------------
// 新增 / 编辑
// ---------------------------------------------------------------------------
export type ContractInput = {
  entityId: number
  contractNo: string
  title: string
  counterparty: string
  counterpartyContact?: string | null
  counterpartyPhone?: string | null
  category?: string
  direction?: string
  amount?: number
  signDate?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: string
  summary?: string | null
}

function normNo(s: string) {
  return s.trim()
}

export async function createContract(input: ContractInput) {
  const scope = await getScope()
  await assertEntityAccess(scope, input.entityId)

  const contractNo = normNo(input.contractNo)
  if (!contractNo) throw new Error('请填写合同编号')
  if (!input.title?.trim()) throw new Error('请填写合同名称')
  if (!input.counterparty?.trim()) throw new Error('请填写对方单位')

  // 编号唯一校验
  const [dup] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.userId, scope.ownerId), eq(contracts.contractNo, contractNo)))
    .limit(1)
  if (dup) throw new Error(`合同编号「${contractNo}」已存在`)

  const [row] = await db
    .insert(contracts)
    .values({
      userId: scope.ownerId,
      entityId: input.entityId,
      contractNo,
      title: input.title.trim(),
      counterparty: input.counterparty.trim(),
      counterpartyContact: input.counterpartyContact?.trim() || null,
      counterpartyPhone: input.counterpartyPhone?.trim() || null,
      category: input.category || 'service',
      direction: input.direction || 'income',
      amount: (input.amount ?? 0).toFixed(2),
      signDate: input.signDate || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      status: input.status || 'draft',
      summary: input.summary?.trim() || null,
    })
    .returning({ id: contracts.id })

  revalidatePath('/contracts')
  return { id: row.id }
}

export async function updateContract(id: number, input: ContractInput) {
  const scope = await getScope()
  await getOwnedContract(scope, id)
  await assertEntityAccess(scope, input.entityId)

  const contractNo = normNo(input.contractNo)
  if (!contractNo) throw new Error('请填写合同编号')

  const [dup] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.userId, scope.ownerId), eq(contracts.contractNo, contractNo)))
    .limit(1)
  if (dup && dup.id !== id) throw new Error(`合同编号「${contractNo}」已存在`)

  await db
    .update(contracts)
    .set({
      entityId: input.entityId,
      contractNo,
      title: input.title.trim(),
      counterparty: input.counterparty.trim(),
      counterpartyContact: input.counterpartyContact?.trim() || null,
      counterpartyPhone: input.counterpartyPhone?.trim() || null,
      category: input.category || 'service',
      direction: input.direction || 'income',
      amount: (input.amount ?? 0).toFixed(2),
      signDate: input.signDate || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      status: input.status || 'draft',
      summary: input.summary?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(contracts.id, id), eq(contracts.userId, scope.ownerId)))

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  return { ok: true }
}

export async function setContractStatus(id: number, status: string) {
  const scope = await getScope()
  await getOwnedContract(scope, id)
  await db
    .update(contracts)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(contracts.id, id), eq(contracts.userId, scope.ownerId)))
  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  return { ok: true }
}

export async function deleteContract(id: number) {
  const scope = await getScope()
  await getOwnedContract(scope, id)
  // 解除流水挂接,删除附件、签署,再删合同
  await db
    .update(transactions)
    .set({ contractId: null })
    .where(and(eq(transactions.userId, scope.ownerId), eq(transactions.contractId, id)))
  await db
    .delete(contractAttachments)
    .where(
      and(
        eq(contractAttachments.userId, scope.ownerId),
        eq(contractAttachments.contractId, id),
      ),
    )
  await db
    .delete(contractSignatures)
    .where(
      and(
        eq(contractSignatures.userId, scope.ownerId),
        eq(contractSignatures.contractId, id),
      ),
    )
  await db
    .delete(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.userId, scope.ownerId)))
  revalidatePath('/contracts')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 附件(base64 dataURL 入库)
// ---------------------------------------------------------------------------
const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB

export async function addAttachment(
  contractId: number,
  file: { fileName: string; mimeType: string; fileSize: number; dataUrl: string },
) {
  const scope = await getScope()
  await getOwnedContract(scope, contractId)
  if (file.fileSize > MAX_FILE_BYTES) throw new Error('单个附件不能超过 4MB')
  if (!file.dataUrl.startsWith('data:')) throw new Error('附件格式不正确')

  await db.insert(contractAttachments).values({
    userId: scope.ownerId,
    contractId,
    fileName: file.fileName.slice(0, 200),
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    dataUrl: file.dataUrl,
  })
  revalidatePath(`/contracts/${contractId}`)
  return { ok: true }
}

export async function deleteAttachment(attachmentId: number) {
  const scope = await getScope()
  const [att] = await db
    .select()
    .from(contractAttachments)
    .where(
      and(
        eq(contractAttachments.id, attachmentId),
        eq(contractAttachments.userId, scope.ownerId),
      ),
    )
    .limit(1)
  if (!att) throw new Error('附件不存在')
  await getOwnedContract(scope, att.contractId)
  await db
    .delete(contractAttachments)
    .where(
      and(
        eq(contractAttachments.id, attachmentId),
        eq(contractAttachments.userId, scope.ownerId),
      ),
    )
  revalidatePath(`/contracts/${att.contractId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 在线签署:记录手写签名 + 时间戳 + 合同哈希留痕;双方签齐后自动置为履行中
// ---------------------------------------------------------------------------
export async function signContract(
  contractId: number,
  input: { party: 'partyA' | 'partyB'; signerName: string; signatureData: string },
) {
  const scope = await getScope()
  const c = await getOwnedContract(scope, contractId)

  if (!input.signerName?.trim()) throw new Error('请填写签署人姓名')
  if (!input.signatureData?.startsWith('data:image')) throw new Error('请先手写签名')

  const hash = contractHash({
    contractNo: c.contractNo,
    title: c.title,
    counterparty: c.counterparty,
    amount: c.amount,
    entityId: c.entityId,
  })

  // 同一方重复签署则覆盖(重新签)
  await db
    .delete(contractSignatures)
    .where(
      and(
        eq(contractSignatures.userId, scope.ownerId),
        eq(contractSignatures.contractId, contractId),
        eq(contractSignatures.party, input.party),
      ),
    )

  await db.insert(contractSignatures).values({
    userId: scope.ownerId,
    contractId,
    party: input.party,
    signerName: input.signerName.trim(),
    signatureData: input.signatureData,
    contractHash: hash,
  })

  // 检查双方是否签齐
  const sigs = await db
    .select({ party: contractSignatures.party })
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.userId, scope.ownerId),
        eq(contractSignatures.contractId, contractId),
      ),
    )
  const parties = new Set(sigs.map((s) => s.party))
  const bothSigned = parties.has('partyA') && parties.has('partyB')

  // 草稿/待签署 → 签署后:单方=待签署,双方=履行中
  let nextStatus = c.status
  if (c.status === 'draft' || c.status === 'pending') {
    nextStatus = bothSigned ? 'active' : 'pending'
  }
  await db
    .update(contracts)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(contracts.id, contractId), eq(contracts.userId, scope.ownerId)))

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')
  return { ok: true, bothSigned }
}

// ---------------------------------------------------------------------------
// 流水勾稽:供"对公进账挂合同"使用
// ---------------------------------------------------------------------------
/** 某主体下可挂接的收入类合同(用于进账关联下拉) */
export async function getContractOptions(entityId?: number) {
  const scope = await getScope()
  const conds: SQL[] = [
    eq(contracts.userId, scope.ownerId),
    inArray(contracts.status, ['pending', 'active', 'completed']),
  ]
  const eid = entityId ?? scope.entityId ?? undefined
  if (eid != null) conds.push(eq(contracts.entityId, eid))
  const rows = await db
    .select({
      id: contracts.id,
      contractNo: contracts.contractNo,
      title: contracts.title,
      counterparty: contracts.counterparty,
      amount: contracts.amount,
      entityId: contracts.entityId,
    })
    .from(contracts)
    .where(and(...conds))
    .orderBy(desc(contracts.signDate))
  return rows.map((r) => ({
    id: r.id,
    contractNo: r.contractNo,
    title: r.title,
    counterparty: r.counterparty,
    amount: Number(r.amount),
    entityId: r.entityId,
  }))
}

/** 将一笔流水挂接到合同(或解除:contractId 传 null) */
export async function linkTransactionContract(transactionId: number, contractId: number | null) {
  const scope = await getScope()
  // 校验流水归属
  const [t] = await db
    .select({ id: transactions.id, entityId: transactions.entityId })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, scope.ownerId)))
    .limit(1)
  if (!t) throw new Error('流水不存在')
  if (scope.role === 'store' && scope.entityId !== t.entityId) {
    throw new Error('无权操作该流水')
  }
  if (contractId != null) {
    await getOwnedContract(scope, contractId)
  }
  await db
    .update(transactions)
    .set({ contractId })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, scope.ownerId)))
  revalidatePath('/accounts')
  if (contractId != null) revalidatePath(`/contracts/${contractId}`)
  return { ok: true }
}
