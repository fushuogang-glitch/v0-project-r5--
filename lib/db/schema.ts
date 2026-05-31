import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  numeric,
  date,
  integer,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  // 角色与数据范围(多租户隔离)
  role: text('role').notNull().default('group'), // group 集团管理员 | store 门店端
  ownerId: text('ownerId'), // 所属集团的 userId(集团管理员=自身);用于数据归属
  entityId: integer('entityId'), // 门店端账号锁定的主体 id
  agentApiKey: text('agentApiKey'), // 财务 Agent API 密钥(集团级,用于公司侧 Agent 抓取门店数据)
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
  name: text('name').notNull(), // 持股人姓名
  shareType: text('shareType').notNull(), // bank 银股 | position 身股 | growth 发展股
  ratio: numeric('ratio', { precision: 5, scale: 2 }).notNull().default('0'), // 分红权比例(%)
  position: text('position'), // 岗位(店长/顾问/外部股东)
  effectiveDate: date('effectiveDate'), // 生效日期
  status: text('status').notNull().default('active'), // active 在册 | exited 已退出
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 员工主数据:贯穿组织架构、工资、股权的中心实体
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

export type Entity = typeof entities.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Shareholder = typeof shareholders.$inferSelect
export type Employee = typeof employees.$inferSelect
export type Department = typeof departments.$inferSelect
export type Position = typeof positions.$inferSelect
