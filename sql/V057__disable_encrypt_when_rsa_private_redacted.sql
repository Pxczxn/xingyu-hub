-- V057：占位 RSA 私钥不能开着登录加密
--
-- V001 为了不把真实私钥打进仓库，把 security.encryptPrivateKey 写成 __REDACTED__，
-- 但 encryptEnabled 仍为 true。管理端会用公钥加密登录密码；服务端解密失败后
-- 把密文交给 BCrypt，表现为「用户名或密码错误」。
--
-- 本迁移只在私钥仍是占位符时关闭加密。应用启动时若发现私钥不可用，会另外
-- 生成可用密钥对（见 CryptoServiceImpl.reloadRsaKeys）。
--
-- 可重复执行：私钥已是真实值时本语句匹配 0 行。

SET NAMES utf8mb4;

UPDATE `sys_config_group`
SET `config_value` = JSON_SET(`config_value`, '$.encryptEnabled', CAST('false' AS JSON))
WHERE `group_code` = 'security'
  AND JSON_UNQUOTE(JSON_EXTRACT(`config_value`, '$.encryptPrivateKey')) = '__REDACTED__';
