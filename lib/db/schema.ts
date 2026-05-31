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

// --- 美业 ERP 财务系统 业务表 ----------------------------------------------
// 所有业务表都带一个普通的 userId 列用于按账号隔离数据(无外键约束)。

// 门店
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(), // 门店编号
  city: text('city').notNull(),
  address: text('address'),
  manager: text('manager'), // 店长
  phone: text('phone'),
  status: text('status').notNull().default('active'), // active | closed
  openedAt: date('openedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 营收记录(收银/开单)
export const revenues = pgTable('revenues', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  storeId: integer('storeId').notNull(),
  bizDate: date('bizDate').notNull(), // 营业日期
  category: text('category').notNull(), // 服务/产品/储值/其他
  channel: text('channel').notNull().default('store'), // 现金/微信/支付宝/银行卡/储值
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  orderCount: integer('orderCount').notNull().default(1), // 订单数
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// 成本/支出记录
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  storeId: integer('storeId').notNull(),
  bizDate: date('bizDate').notNull(),
  category: text('category').notNull(), // 房租/人力/物料/水电/营销/其他
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export type Store = typeof stores.$inferSelect
export type Revenue = typeof revenues.$inferSelect
export type Expense = typeof expenses.$inferSelect
