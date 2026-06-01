import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  numeric,
  date,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  // 登录账号:手机号或自定义用户名(username 插件,小写归一化后唯一);displayUsername 保留原始大小写
  username: text('username').unique(),
  displayUsername: text('displayUsername'),
  // 角色与数据范围(多租户隔离)
  role: text('role').notNull().default('group'), // group 集团管理员 | store 门店端 | platform 平台运营超管
  ownerId: text('ownerId'), // 所属集团的 userId(集团管理员=自身);用于数据归属
  entityId: integer('entityId'), // 门店端账号锁定的主体 id
  agentApiKey: text('agentApiKey'), // 财务 Agent API 密钥(集团级,用于公司侧 Agent 抓取门店数据)
  // 财务岗位角色(仅财务子账号):cashier 出纳 | accountant 会计 | auditor 审计 | tax 税务专员;集团管理员/门店端为 null
  financeRole: text('financeRole'),
  // 平台运营元数据(仅租户主账号有意义,供 SaaS 中台地图/订阅监控)
  province: text('province'), // 客户所在省份(中文全称,匹配地图)
  plan: text('plan').default('trial'), // 套餐:trial 试用 | basic 基础 | pro 专业 | flagship 旗舰
  subscriptionEndsAt: timestamp('subscriptionEndsAt'), // 订阅到期日
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- 诺塔智·美业财务智能 ERP 业务表 ----------------------------------------
// 所有业务表都带一个普通的 userId 列用于按账号隔离数据(无外键约束)。

// 纳税主体:每个独立纳税的公司 / 门店 / 个体户
export const entities = pgTable('entities', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(), // 主体名称
  code: text('code').notNull(), // 主体编号
  entityType: text('entityType').notNull().default('company'), // company 公司 | sole 个体户 | store 门店
  departmentId: integer('departmentId'), // 归属的集团中控部门(如运营中心)
  creditCode: text('creditCode'), // 统一社会信用代码
  legalPerson: text('legalPerson'), // 法人
  taxpayerType: text('taxpayerType').notNull().default('small'), // small 小规模 | general 一般纳税人
  region: text('region'), // 区域 / 大区
  city: text('city'),
  address: text('address'),
  phone: text('phone'), // 联系电话
  taxAuthority: text('taxAuthority'), // 主管税务局
  bankName: text('bankName'), // 开户行
  bankAccount: text('bankAccount'), // 对公银行账号
  status: text('status').notNull().default('active'), // active 经营中 | closed 已注销
  establishDate: date('establishDate'), // 成立日期
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 统一流水:全系统单一真实数据源(销售/采购/费用/收款等)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  entityId: integer('entityId').notNull(),
  bizDate: date('bizDate').notNull(), // 业务发生日期
  bizType: text('bizType').notNull(), // income 收入 | expense 支出
  category: text('category').notNull(), // 业务分类(护理/零售/房租/人力 等)
  channel: text('channel').notNull().default('store'), // 收付渠道
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(), // 含税金额
  taxRate: numeric('taxRate', { precision: 5, scale: 4 }).notNull().default('0'), // 税率
  taxAmount: numeric('taxAmount', { precision: 14, scale: 2 }).notNull().default('0'), // 增值税额
  surtaxAmount: numeric('surtaxAmount', { precision: 14, scale: 2 }).notNull().default('0'), // 附加税费
  netAmount: numeric('netAmount', { precision: 14, scale: 2 }).notNull().default('0'), // 不含税金额
  invoiced: boolean('invoiced').notNull().default(false), // 是否已开票
  invoiceMedium: text('invoiceMedium').notNull().default('none'), // none | electronic 电子 | paper 纸质
  invoiceKind: text('invoiceKind').notNull().default('none'), // none | special 专票 | general 普票 | receipt 收据
  invoiceNo: text('invoiceNo'), // 发票号码
  invoiceCode: text('invoiceCode'), // 发票代码
  summary: text('summary'), // 摘要
  source: text('source').notNull().default('manual'), // manual 手工 | pos | bank | invoice | agent
  status: text('status').notNull().default('posted'), // posted 已记账 | draft 草稿
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 收款账户:每个主体下的微信/支付宝/对公银行/现金/POS/储值卡等收款渠道
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 数据归属(集团 owner)
  entityId: integer('entityId').notNull(), // 所属主体/门店
  name: text('name').notNull(), // 账户名称
  accountType: text('accountType').notNull(), // wechat|alipay|bank|cash|pos|stored_value
  channel: text('channel').notNull(), // 与流水 channel 对应,用于汇总收款额
  accountNo: text('accountNo'), // 账号/卡号(脱敏)
  holder: text('holder'), // 开户名/持有人
  maxLimit: numeric('maxLimit', { precision: 14, scale: 2 }), // 最高收款额度(NULL=不限额),累计收款达到后提示满额
  status: text('status').notNull().default('active'), // active | disabled
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })

// 三层股权:银股(实股出资)/ 身股(岗位人力股)/ 发展股(带教激励股)
// level=entity 与单店关联;level=group 为集团层,基于全部门店合并净利润分红
export const shareholders = pgTable('shareholders', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 数据归属(集团 owner)
  level: text('level').notNull().default('entity'), // group 集团层 | entity 门店层
  entityId: integer('entityId'), // 关联门店/主体(集团层为空)
  employeeId: integer('employeeId'), // 绑定的架构员工(可选)
  name: text('name').notNull(), // 持��人姓名
  shareType: text('shareType').notNull(), // bank 银股 | position 身股 | growth 发展股
  ratio: numeric('ratio', { precision: 5, scale: 2 }).notNull().default('0'), // 分红权比例(%)
  position: text('position'), // 岗位(店长/顾问/外部股东)
  effectiveDate: date('effectiveDate'), // 生效日期
  status: text('status').notNull().default('active'), // active 在册 | exited 已退出
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 员工主数据:贯穿组织架构、工资���股权��中心实体
// level=group 集团层(高管,entityId 空)| level=entity 门店层;managerId 指向上级员工构成组织树
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 数据归属(集团 owner)
  level: text('level').notNull().default('entity'), // group 集团层 | entity 门店层
  entityId: integer('entityId'), // 所属门店(集团层为空)
  departmentId: integer('departmentId'), // 集团层员工所属中控部门
  name: text('name').notNull(), // 姓名
  position: text('position'), // 岗位(店长/美容顾问/技师/集团高管)
  jobLevel: text('jobLevel').notNull().default('staff'), // exec 高管 | manager 店长 | supervisor 主管 | staff 员工
  managerId: integer('managerId'), // 直接上级员工 id(组织树)
  phone: text('phone'),
  hireDate: date('hireDate'), // 入职日期
  status: text('status').notNull().default('active'), // active 在职 | left 离职
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 集团中控部门字典:运营中心、财务中心、人力中心等,企业可自行增减
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 门店岗位字典:店长、顾问、美容师、前台、阿姨、医生、护士等,企业可自行增减
export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 月度工资明细:每名员工每月一行,拆分基本工资/提成/补贴/扣款/实发
// entityId 冗余记录所属门店,便于「门店工资 ÷ 营业额」占比统计
export const salaries = pgTable('salaries', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 数据归属(集团 owner)
  employeeId: integer('employeeId').notNull(), // 员工
  entityId: integer('entityId'), // 所属门店(集团员工为空)
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  baseSalary: numeric('baseSalary', { precision: 12, scale: 2 }).notNull().default('0'), // 基本工资
  commission: numeric('commission', { precision: 12, scale: 2 }).notNull().default('0'), // 提成
  allowance: numeric('allowance', { precision: 12, scale: 2 }).notNull().default('0'), // 补贴
  deduction: numeric('deduction', { precision: 12, scale: 2 }).notNull().default('0'), // 扣款
  netPay: numeric('netPay', { precision: 12, scale: 2 }).notNull().default('0'), // 实发
  note: text('note'),
  source: text('source').notNull().default('manual'), // manual 手工 | agent 接口录入
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- V2 升级:SaaS 对接配置(集团级,一行一集团) --------------------------
// 存储 BA-CRM SaaS 接口地址 + API Key(密文)+ 上次同步状态。
export const saasConfig = pgTable('saas_config', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 集团归属(唯一)
  baseUrl: text('baseUrl'), // SaaS 接口根地址
  apiKeyEnc: text('apiKeyEnc'), // 加密存储的 SaaS API Key
  status: text('status').notNull().default('unconfigured'), // unconfigured | connected | error
  lastTestedAt: timestamp('lastTestedAt'), // 上次测试连接时间
  lastSyncedAt: timestamp('lastSyncedAt'), // 上次同步时间
  lastSyncReport: jsonb('lastSyncReport'), // 上次同步报告(各类数据条数等)
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- V2 升级:主体 ↔ SaaS storeCode 映射(覆盖默认 entity.code) ----------
export const saasEntityMap = pgTable('saas_entity_map', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  entityId: integer('entityId').notNull(),
  storeCode: text('storeCode').notNull(), // 对应 SaaS 侧门店编码
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- V2 升级:税务合规节点(按主体 + 期间自动生成的合规提醒) --------------
export const complianceNodes = pgTable('compliance_nodes', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 集团归属
  entityId: integer('entityId'), // 关联主体(集团级提醒可空)
  nodeType: text('nodeType').notNull(), // vat_filing | cit_prepay | cit_settle | vat_exempt | small_profit | general_taxpayer | license_expiry | stamp_tax 等
  title: text('title').notNull(), // 提醒标题
  detail: text('detail'), // 说明
  period: text('period'), // 所属期间(2026Q1 / 2026-05 / 2026 等)
  dueDate: date('dueDate'), // 法定截止日 / 临界触发日
  remindAt: date('remindAt'), // 提前提醒日
  level: text('level').notNull().default('info'), // info | warning | danger
  status: text('status').notNull().default('pending'), // pending 待办 | filed 已申报 | overdue 逾期 | dismissed 已忽略
  meta: jsonb('meta'), // 附加数据(临界占比/金额等)
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- V2 升级:租户品牌信息 + 安全设置 + 自动同步配置(集团级,一行一集团) ---
// 区别于产品品牌(诺塔智控 FMS,固定),这里登记的是客户自己的集团/品牌信息,
// 如「双美集团」,用于驾驶舱标题、报表抬头等。同表存放敏感操作的安全 PIN(密文)
// 与双架构同步的自动化设置。
export const orgProfile = pgTable('org_profile', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().unique(), // 集团归属(唯一)
  brandName: text('brandName'), // 品牌名(如「双美」)
  groupName: text('groupName'), // 集团全称(如「双美集团」)
  shortName: text('shortName'), // 简称
  slogan: text('slogan'), // 品牌标语
  legalEntity: text('legalEntity'), // 品牌运营主体公司
  industry: text('industry'), // 所属行业
  logoUrl: text('logoUrl'), // 品牌 Logo
  contactName: text('contactName'), // 联系人
  contactPhone: text('contactPhone'),
  contactEmail: text('contactEmail'),
  headquarters: text('headquarters'), // 总部地址
  website: text('website'),
  securityPinEnc: text('securityPinEnc'), // 安全 PIN(加密存储),用于解锁敏感模块
  autoSyncEnabled: boolean('autoSyncEnabled').notNull().default(false), // 是否启用进入系统自动补同步
  autoSyncIntervalMin: integer('autoSyncIntervalMin').notNull().default(360), // 自动补同步最小间隔(分钟)
  lastAutoSyncAt: timestamp('lastAutoSyncAt'), // 上次自动补同步时间
  primaryChannel: text('primaryChannel').notNull().default('agent'), // 主同步通道:agent Agent推送 | auto 自动拉取
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export type OrgProfile = typeof orgProfile.$inferSelect

// --- 月度自动审计结果 -------------------------------------------------------
// 每月幂等生成:按 (userId, period, entityId, code) 唯一,重跑覆盖更新
export const auditFindings = pgTable('audit_findings', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(), // 数据归属集团
  period: text('period').notNull(), // 审计期间 YYYY-MM
  entityId: integer('entityId'), // 关联主体(null=集团级)
  dimension: text('dimension').notNull(), // revenue 收支 | reconciliation 对账 | tax 税务 | payroll 工资分红 | account 账户满额
  code: text('code').notNull(), // 规则编码(幂等键)
  level: text('level').notNull().default('pass'), // pass 通过 | warn 警告 | risk 异常
  title: text('title').notNull(),
  detail: text('detail'),
  metric: numeric('metric', { precision: 16, scale: 2 }), // 关联金额/比率
  status: text('status').notNull().default('open'), // open 待处理 | resolved 已处理
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export type AuditFinding = typeof auditFindings.$inferSelect

// --- 平台运营中台:租户(软件实例)每日健康快照 -----------------------------
// 跨全租户预聚合,按 (tenantId, snapshotDate) 幂等;中控台读最新快照,避免实时全表扫描
export const tenantHealth = pgTable('tenant_health', {
  id: serial('id').primaryKey(),
  tenantId: text('tenantId').notNull(), // 租户主账号 userId(= 一个软件实例)
  snapshotDate: date('snapshotDate').notNull(),
  tenantName: text('tenantName'),
  entityCount: integer('entityCount').notNull().default(0), // 主体/门店数
  txnCount30d: integer('txnCount30d').notNull().default(0), // 近 30 天流水笔数
  lastTxnAt: timestamp('lastTxnAt'), // 最近一条流水时间(数据心跳)
  lastLoginAt: timestamp('lastLoginAt'), // 最近登录(活跃)
  lastSyncAt: timestamp('lastSyncAt'), // 最近同步
  agentCount30d: integer('agentCount30d').notNull().default(0), // 近 30 天 Agent 回填条数
  auditRan: boolean('auditRan').notNull().default(false), // 本月是否已审计
  revenue30d: numeric('revenue30d', { precision: 16, scale: 2 }).notNull().default('0'), // 近 30 天收入(聚合金额)
  province: text('province'), // 客户省份(快照冗余,便于地图聚合)
  plan: text('plan'), // 套餐
  daysToExpiry: integer('daysToExpiry'), // 订阅剩余天数,负数=已过期,null=未设置
  taxRiskOverdue: integer('taxRiskOverdue').notNull().default(0), // 税务风险超 7 天未处理数
  healthScore: integer('healthScore').notNull().default(100), // 综合健康分 0-100
  status: text('status').notNull().default('ok'), // ok 正常 | risk 风险 | down 异常
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export type TenantHealth = typeof tenantHealth.$inferSelect

// --- 平台运营中台:实例告警 -------------------------------------------------
// 幂等:同一租户同一 code 仅一条活动告警;notified 预留通知接口对接
export const platformAlerts = pgTable('platform_alerts', {
  id: serial('id').primaryKey(),
  tenantId: text('tenantId').notNull(),
  tenantName: text('tenantName'),
  code: text('code').notNull(), // 告警编码(幂等键)
  dimension: text('dimension').notNull(), // offline 离线 | data 数据断流 | sync 同步 | audit 审计 | churn 流失
  level: text('level').notNull().default('warn'), // info 提示 | warn 警告 | risk 严重
  title: text('title').notNull(),
  detail: text('detail'),
  metric: numeric('metric', { precision: 16, scale: 2 }),
  status: text('status').notNull().default('open'), // open 待处理 | resolved 已处理
  notified: boolean('notified').notNull().default(false), // 是否已推送通知(预留)
  firstSeenAt: timestamp('firstSeenAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  resolvedAt: timestamp('resolvedAt'),
})

export type PlatformAlert = typeof platformAlerts.$inferSelect

export type Entity = typeof entities.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Shareholder = typeof shareholders.$inferSelect
export type Employee = typeof employees.$inferSelect
export type Department = typeof departments.$inferSelect
export type Position = typeof positions.$inferSelect
export type Salary = typeof salaries.$inferSelect
export type SaasConfig = typeof saasConfig.$inferSelect
export type SaasEntityMap = typeof saasEntityMap.$inferSelect
export type ComplianceNode = typeof complianceNodes.$inferSelect
