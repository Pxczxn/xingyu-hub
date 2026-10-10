-- V049: re-auth grant 单次消费 —— 高风险操作（停用账号）防重放
--
-- 背景（Settings / Account Security Audit 的 B2）：
--   `recent_authentication` 只记录了"某人在某会话里于 15 分钟前验证过密码"，
--   但**没有消费标记**。`RecentAuthenticationService.requireValidRecentAuth`
--   因此是可重放的：同一个 grant id 在 15 分钟窗口内能被反复使用。
--
--   原来的唯一消费点是邮箱换绑，可换绑本身幂等（重复申请只是重发一封信），
--   所以这个缺陷当时不致命。但本轮把"停用账号"接了同一个 grant，
--   而停用是不可逆的一次性动作 —— 一个 15 分钟内被 XSS 抄走的 grant id
--   就能让攻击者反复触发停用，也能和别的操作交叉滥用。
--
-- 本迁移给 `recent_authentication` 加 `consumed_at`，语义与
-- `email_verification_token.consumed_at` 完全一致（NULL = 未消费）。
--
-- 幂等与安全：
--   * 通过 information_schema 守卫，列已存在则跳过，重复执行不报错；
--   * 只加列，不改任何既有列的语义，不动历史数据（存量行的 consumed_at
--     一律为 NULL，即"未消费"，与迁移前它们本来的可用状态一致 —— 不制造
--     迁移前能用的 grant 在迁移后突然失效）；
--   * 不加 UNIQUE：这张表按行存每次验证，历史行本来就允许多条；
--   * 迁移文件必须是 LF 行尾（LegacyMigrationChecksumsTest 强制）。
--
-- 消费动作由应用层的原子 UPDATE 完成（consumed_at IS NULL 作为 WHERE 条件），
-- 与 EmailVerificationTokenMapper.consumeOnce 同一套并发语义：
-- 并发请求只有一个能把 NULL 改成非 NULL，其余得到 0 行 → 判为已消费。

SET NAMES utf8mb4;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recent_authentication'
    AND COLUMN_NAME = 'consumed_at'
);

SET @sql = IF(
  @col_exists,
  'SELECT 1',
  'ALTER TABLE `recent_authentication` ADD COLUMN `consumed_at` timestamp NULL DEFAULT NULL COMMENT ''消费时间（UTC），非空表示该 grant 已被高风险操作使用''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 与 email_verification_token 对齐：查询待消费 grant 时会带上这一列，
-- 顺带补上列注释，避免 information_schema 里读不到语义。
SET @comment_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recent_authentication'
    AND COLUMN_NAME = 'consumed_at'
    AND COLUMN_COMMENT LIKE '%消费时间%'
);

SET @sql = IF(
  @comment_exists,
  'SELECT 1',
  'ALTER TABLE `recent_authentication` MODIFY COLUMN `consumed_at` timestamp NULL DEFAULT NULL COMMENT ''消费时间（UTC），非空表示该 grant 已被高风险操作使用''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
