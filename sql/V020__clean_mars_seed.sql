-- V020：清理 V001 遗留的 Mars 演示账号与审计垃圾数据
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM `sys_user_role` WHERE `user_id` <> 1;
DELETE FROM `sys_user_post` WHERE `user_id` <> 1;
DELETE FROM `sys_user_notice` WHERE `user_id` <> 1;
DELETE FROM `sys_user_blacklist` WHERE `user_id` <> 1;
DELETE FROM `sys_user` WHERE `id` <> 1;

UPDATE `sys_user`
SET `status` = 1,
    `deleted` = 0,
    `username` = 'admin',
    `nickname` = '超级管理员'
WHERE `id` = 1;

TRUNCATE TABLE `sys_oper_log`;
TRUNCATE TABLE `sys_api_access_log`;
TRUNCATE TABLE `sys_login_log`;
TRUNCATE TABLE `sys_job_log`;
TRUNCATE TABLE `sys_sms_log`;
TRUNCATE TABLE `sys_notice_send_log`;

SET FOREIGN_KEY_CHECKS = 1;
