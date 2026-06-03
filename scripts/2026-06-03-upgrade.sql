-- =====================================================================
-- 塔塔财务中台 · 运营中控台升级迁移(2026-06-03)
-- 幂等脚本:可重复执行,不会破坏现有数据与 better-auth 登录体系。
-- 请在生产 PostgreSQL(118.25.146.225)上执行一次。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. user 表新增运营/安全字段(全部 ADD COLUMN IF NOT EXISTS,纯加法)
-- ---------------------------------------------------------------------
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bossName" text;            -- 老板/负责人姓名
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "city" text;                -- 所在城市
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "address" text;             -- 详细地址
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "contactPhone" text;        -- 联系电话(可与登录账号不同)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accountStatus" text NOT NULL DEFAULT 'active'; -- active 正常 | suspended 停用 | expired 已到期
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscriptionStartAt" timestamp; -- 开通日期
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pwdPlainEnc" text;         -- 登录密码 AES 加密副本(供超管查看明文)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pwdUpdatedAt" timestamp;   -- 密码最近更新时间

-- 回填:已有集团租户的开通日期取其创建时间
UPDATE "user"
   SET "subscriptionStartAt" = "createdAt"
 WHERE "role" = 'group' AND "subscriptionStartAt" IS NULL;

-- ---------------------------------------------------------------------
-- 2. 租户改密历史(每次中台重置密码留痕,不含明文)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenant_pwd_history" (
  "id"          serial PRIMARY KEY,
  "tenantId"    text NOT NULL,             -- 租户主账号 userId
  "operatorId"  text NOT NULL,             -- 操作的平台超管 userId
  "operatorName" text,                     -- 操作人姓名(冗余)
  "note"        text,                      -- 备注(如:客户遗忘密码)
  "createdAt"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_pwd_history_tenant" ON "tenant_pwd_history" ("tenantId");

-- ---------------------------------------------------------------------
-- 3. 租户续费记录
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenant_renewal" (
  "id"          serial PRIMARY KEY,
  "tenantId"    text NOT NULL,
  "operatorId"  text NOT NULL,
  "operatorName" text,
  "days"        integer NOT NULL,          -- 本次续费天数
  "planBefore"  text,                      -- 续费前套餐
  "planAfter"   text,                      -- 续费后套餐
  "endsAtBefore" timestamp,                -- 续费前到期日
  "endsAtAfter"  timestamp,                -- 续费后到期日
  "note"        text,
  "createdAt"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_renewal_tenant" ON "tenant_renewal" ("tenantId");

-- ---------------------------------------------------------------------
-- 4. 明文密码查看审计(谁、何时、查看了哪个租户的密码)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenant_pwd_view_log" (
  "id"          serial PRIMARY KEY,
  "tenantId"    text NOT NULL,
  "operatorId"  text NOT NULL,
  "operatorName" text,
  "ip"          text,
  "createdAt"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_pwd_view_tenant" ON "tenant_pwd_view_log" ("tenantId");

-- =====================================================================
-- 迁移完成。验证:
--   \d "user"  应看到 bossName/city/accountStatus/pwdPlainEnc 等新列。
--   \dt        应看到 tenant_pwd_history / tenant_renewal / tenant_pwd_view_log。
-- =====================================================================
