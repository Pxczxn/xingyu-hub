-- V045：私信附件的文件标识（附件访问权限前置条件）
--
-- 背景（2026-10-06 Messages Correctness Recovery 的安全 blocker）：
--   社区私信附件上传后拿到的是 `/api/v1/admin/files/community/messages/<hash>` 这种
--   **无鉴权**的静态地址（`FileAccessController` 只做路径穿越检查，不校验会话），
--   任何人拿到或猜到 URL 就能下载。已实测：不带任何 token 请求该地址返回 200。
--
-- 本迁移只做一件事：让消息行记住它引用的 `sys_file.id`，从而可以用项目**已有的**
-- 安全读文件能力（`SysFileService.getFileBytes(id)` → `FileStorage`，local/MinIO 都支持）
-- 走一条「校验 conversation membership 后再吐字节」的受鉴权下载端点，而不是靠
-- 「路径难猜」当权限。
--
-- 为什么存 id 而不是解析 URL 里的路径：URL 是展示层产物（会随域名/前缀变化），
-- 路径解析要跟着它变；`sys_file.filePath` 才是存储层事实。
--
-- 可空：TEXT 消息没有附件；历史行保持 NULL，读端点对 NULL 直接 404。
--
-- 幂等：列已存在则跳过（守卫模式同 V031 / V041 / V044）。
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'chat_message'
     AND COLUMN_NAME = 'attachment_file_id') = 0,
  'ALTER TABLE `chat_message` ADD COLUMN `attachment_file_id` bigint DEFAULT NULL COMMENT ''附件对应的 sys_file.id（受鉴权下载用；TEXT 消息为 NULL）'' AFTER `attachment_name`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
