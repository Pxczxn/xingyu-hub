-- V019：移除 Mars 脚手架演示表与菜单（保留 sys_post 等管理端核心表）
-- 旧版 Mars 群聊已由 V016 conversation/chat_message 替代

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (
  SELECT `id` FROM `sys_menu` WHERE `permission` LIKE 'system:student:%'
    OR `path` LIKE '%/student%'
    OR `component` LIKE '%student%'
);

DELETE FROM `sys_menu` WHERE `permission` LIKE 'system:student:%'
  OR `path` LIKE '%/student%'
  OR `component` LIKE '%student%';

DELETE FROM `gen_table_column` WHERE `table_id` = 4;
DELETE FROM `gen_table` WHERE `table_name` = 'student';

DROP TABLE IF EXISTS `sys_chat_group_message`;
DROP TABLE IF EXISTS `sys_chat_message`;
DROP TABLE IF EXISTS `sys_chat_group_member`;
DROP TABLE IF EXISTS `sys_chat_group`;
DROP TABLE IF EXISTS `coder_banner`;
DROP TABLE IF EXISTS `student`;
