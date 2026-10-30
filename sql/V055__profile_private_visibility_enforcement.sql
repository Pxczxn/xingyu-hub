-- V055: PRIVATE 资料语义收紧为“仅本人可见”。
--
-- 旧实现 CommunityProfileService.getPublicProfile 对 PRIVATE 跳过 AccessPolicy，
-- 所以注册默认写入的 PRIVATE 实际等于“不列出但仍可通过链接读取”。本次改为
-- 真正仅本人可见后，需要把历史默认值迁移掉，否则所有老用户主页会突然 404。
--
-- lock_version = 0 表示资料从未被用户保存过，即注册默认值；迁移为 PUBLIC，
-- 保留升级前“任何人都能打开”的实际表现。lock_version > 0 的 PRIVATE 视为
-- 用户主动选择，保留其隐私语义。
UPDATE community_profile
SET visibility = 'PUBLIC'
WHERE visibility = 'PRIVATE'
  AND lock_version = 0;
