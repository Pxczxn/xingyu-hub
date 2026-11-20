-- 回滚 V060：删除身份授权与交叉核验表。
-- ⚠️ 会丢失这两张表中的全部行（本批迁移本身不写入数据）。执行前先备份。
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `identity_verify_link`;
DROP TABLE IF EXISTS `community_user_role`;
