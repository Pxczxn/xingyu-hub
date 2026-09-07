-- V027：社区端固定使用 satoken 请求头，须与 Sa-Token 运行时配置一致。
SET NAMES utf8mb4;

UPDATE `sys_config_group`
SET `config_value` = JSON_SET(`config_value`, '$.tokenName', 'satoken')
WHERE `group_code` = 'security';
