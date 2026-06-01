import { betterAuth } from 'better-auth'
import { username as usernamePlugin } from 'better-auth/plugins'
import { pool } from '@/lib/db'
import { isValidUsername, USERNAME_MIN, USERNAME_MAX } from '@/lib/account-id'

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    // 用户名 / 手机号登录:放宽校验以支持中文用户名;手机号(纯数字)天然满足
    usernamePlugin({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => isValidUsername(value),
    }),
  ],
  user: {
    additionalFields: {
      // 角色与数据范围。input:false 表示注册时不可由前端设置,只能服务端写入。
      role: { type: 'string', required: false, defaultValue: 'group', input: false },
      ownerId: { type: 'string', required: false, input: false },
      entityId: { type: 'number', required: false, input: false },
      // 财务岗位角色(出纳/会计/审计/税务专员),仅服务端写入
      financeRole: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // 新注册的集团管理员:数据归属指向自身
        after: async (createdUser) => {
          await pool.query('UPDATE "user" SET "ownerId" = $1 WHERE id = $1', [
            createdUser.id,
          ])
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
