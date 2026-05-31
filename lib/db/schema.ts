import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- 美业财务 ERP 业务表 ----------------------------------------------------
// 所有业务表都带一个普通的 userId 列用于按账号隔离数据(无外键约束)。

// 主体:独立纳税主体(公司 / 个体户 / 分支机构)= 门店/公司
export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(), // 主体名称
  code: text("code").notNull(), // 内部编码
  entityType: text("entityType").notNull().default("company"), // company 公司 / individual 个体户 / branch 分支机构
  creditCode: text("creditCode"), // 统一社会信用代码
  legalPerson: text("legalPerson"), // 法人
  taxpayerType: text("taxpayerType").notNull().default("small"), // small 小规模 / general 一般纳税人
  region: text("region"), // 区域(看板分组用,如 华东/华南)
  city: text("city"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active 存续 / closed 注销 / revoked 吊销
  establishDate: date("establishDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// 统一流水:单一真实数据源
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  entityId: integer("entityId").notNull(),
  bizDate: date("bizDate").notNull(),
  bizType: text("bizType").notNull(), // sale 销售 / purchase 采购 / expense 费用 / receipt 收款
  category: text("category").notNull(), // 品类/科目:美容项目/美发/产品零售/房租/人力...
  channel: text("channel").notNull().default("store"), // store 到店 / online 线上 / member 会员储值
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // 含税金额
  taxRate: numeric("taxRate", { precision: 5, scale: 4 }).notNull().default("0"), // 税率
  taxAmount: numeric("taxAmount", { precision: 14, scale: 2 }).notNull().default("0"), // 税额
  netAmount: numeric("netAmount", { precision: 14, scale: 2 }).notNull().default("0"), // 不含税金额
  invoiced: boolean("invoiced").notNull().default(false), // 是否已开票
  summary: text("summary"), // 摘要
  source: text("source").notNull().default("manual"), // manual 手工 / import 导入 / api 接口 / agent 门店Agent
  status: text("status").notNull().default("posted"), // draft 草稿 / pending 待审 / posted 已过账
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export type Entity = typeof entities.$inferSelect
export type Transaction = typeof transactions.$inferSelect
