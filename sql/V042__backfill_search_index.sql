-- V042__backfill_search_index.sql
--
-- 回填公开搜索索引（search_document）。
--
-- 背景：`search_document` 是首页 feed、搜索、话题内容、发现页、收藏存在性校验、活动投稿
-- 校验的**唯一数据源**，但在此之前**没有任何生产代码会往它里面写** —— 全仓唯一的
-- `INSERT INTO search_document` 在开发期种子脚本 `scripts/seed_sample_content.py` 里。
-- 后果：用户自己发布的内容永远不会出现在任何内容流里，收藏也必然 404
-- （`CollectionService.validateObject` 要求对象已入索引）。
--
-- 本次改动补上了「内容生命周期事件 → SearchIndexEventHandler → SearchIndexService」这条
-- 链路（产品文档 v3.2 §20.3：发布、隐藏、删除、恢复、账号冻结等事件都必须驱动索引更新）。
-- 本迁移负责把**已经存在**的内容补进索引，相当于 §20.3 要求的「人工重建索引」的一次性版本；
-- 此后新发布的内容由事件链路自动入索引。
--
-- 幂等：每条 INSERT 都带 NOT EXISTS 守卫，重复执行不会产生重复行，也不会覆盖已有索引。
--
-- 注意：这里刻意**不**用 article.status = 'PUBLISHED' 作为公开判据。提交新修订会把
-- article.status 打回 IN_REVIEW，而上一版已发布修订仍然对外可读 —— 用 status 判断会把
-- 正在编辑的线上内容从索引里剔掉。真正的判据是「存在 published_revision 行」，与
-- ContentCoverService、公开文章接口用的是同一个信号。

-- 1. 已发布文章：标题/摘要取自**已发布修订**（published_revision -> formal_revision），
--    而不是工作草稿。
INSERT INTO `search_document`
  (`id`, `object_type`, `object_id`, `title`, `summary`, `discovery_version`, `indexed_at`, `removed_at`)
SELECT UUID(), 'ARTICLE', a.`id`, LEFT(fr.`title`, 256), LEFT(fr.`summary`, 1024), 1, NOW(), NULL
FROM `article` a
INNER JOIN `published_revision` pr ON pr.`article_id` = a.`id`
INNER JOIN `formal_revision` fr ON fr.`id` = pr.`formal_revision_id`
WHERE a.`lifecycle_status` = 'ACTIVE'
  AND (a.`moderation_status` IS NULL OR a.`moderation_status` = 'NORMAL')
  AND fr.`title` IS NOT NULL AND TRIM(fr.`title`) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `search_document` sd
    WHERE sd.`object_type` = 'ARTICLE' AND sd.`object_id` = a.`id`
  );

-- 2. 启用中的系列。
INSERT INTO `search_document`
  (`id`, `object_type`, `object_id`, `title`, `summary`, `discovery_version`, `indexed_at`, `removed_at`)
SELECT UUID(), 'SERIES', s.`id`, LEFT(s.`title`, 256), LEFT(s.`description`, 1024), 1, NOW(), NULL
FROM `series` s
WHERE s.`status` = 'ACTIVE'
  AND s.`title` IS NOT NULL AND TRIM(s.`title`) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `search_document` sd
    WHERE sd.`object_type` = 'SERIES' AND sd.`object_id` = s.`id`
  );

-- 3. 已发布动态。动态没有标题列，索引标题取正文第一行（与 SearchIndexService 的投影口径一致）；
--    用 CHAR(10) 而不是 '\n'，避免依赖 MySQL 的反斜杠转义模式。
INSERT INTO `search_document`
  (`id`, `object_type`, `object_id`, `title`, `summary`, `discovery_version`, `indexed_at`, `removed_at`)
SELECT UUID(), 'MOMENT', m.`id`,
       LEFT(TRIM(SUBSTRING_INDEX(TRIM(mr.`body`), CHAR(10), 1)), 80),
       LEFT(mr.`body`, 1024), 1, NOW(), NULL
FROM `moment` m
INNER JOIN `moment_revision` mr ON mr.`id` = (
    SELECT r2.`id` FROM `moment_revision` r2
    WHERE r2.`moment_id` = m.`id`
    ORDER BY r2.`revision_number` DESC
    LIMIT 1
)
WHERE m.`status` = 'PUBLISHED'
  AND mr.`body` IS NOT NULL AND TRIM(mr.`body`) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `search_document` sd
    WHERE sd.`object_type` = 'MOMENT' AND sd.`object_id` = m.`id`
  );
