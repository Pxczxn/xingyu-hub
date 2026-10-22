-- V053：可靠事件（outbox）租约恢复索引
--
-- 背景：
--   ReliableEventConsumer.poll 每轮先在 reliable_event 上执行两条条件 UPDATE
--   （reclaimExpiredLeases / isolateExpiredLeases），按 status + lease_until 过滤。
--   V002 只建了主键与 event_id 唯一键，这两条语句在该表上只能走全索引扫描：
--
--     实测（本机 MySQL 8.0.46，REPEATABLE READ，20 万行探针表，199,990 SUCCESS + 10 PROCESSING）：
--       * 无索引：回收 UPDATE 约 0.95 s，执行期间持 gap/next-key 锁，
--                 并发的 outbox INSERT 被阻塞（2 s 锁等待超时实验可复现）；
--       * 有索引：回收 UPDATE 约 0.0009 s（EXPLAIN：type=range，rows=1）。
--
--   findClaimable 的 status IN ('PENDING','FAILED') 过滤同样受益于该索引前缀。
--
-- 说明：
--   * 索引不消除 gap lock（RR 下进程级冲突仍在），但把持锁窗口从秒级缩到毫秒级；
--   * 不新增列、不改状态机，回滚只需 DROP INDEX。
--
-- 幂等：索引已存在时跳过。
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'reliable_event'
     AND INDEX_NAME = 'idx_reliable_event_status_lease') = 0,
  'ALTER TABLE `reliable_event` ADD KEY `idx_reliable_event_status_lease` (`status`, `lease_until`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
