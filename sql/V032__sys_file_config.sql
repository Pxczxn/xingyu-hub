-- V032：管理端文件存储配置
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_file_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `name` varchar(128) NOT NULL COMMENT '配置名称',
  `storage_type` varchar(32) NOT NULL COMMENT '存储类型：local/minio/aliyun/tencent/rustfs',
  `master` tinyint NOT NULL DEFAULT 0 COMMENT '是否主配置：0/1',
  `domain` varchar(512) NOT NULL DEFAULT '' COMMENT '访问域名',
  `base_path` varchar(512) DEFAULT NULL COMMENT '本地存储根路径',
  `bucket_name` varchar(128) DEFAULT NULL COMMENT '桶名称',
  `access_key` varchar(256) DEFAULT NULL COMMENT '访问密钥',
  `secret_key` varchar(512) DEFAULT NULL COMMENT '秘密密钥',
  `endpoint` varchar(512) DEFAULT NULL COMMENT '服务端点',
  `region` varchar(64) DEFAULT NULL COMMENT '区域',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
  `remark` varchar(512) DEFAULT NULL COMMENT '备注',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_sys_file_config_master` (`master`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文件存储配置';

INSERT IGNORE INTO `sys_file_config` (`id`, `name`, `storage_type`, `master`, `domain`, `base_path`, `status`, `remark`)
VALUES (1, '本地存储', 'local', 1, 'http://localhost:7779', 'runtime/uploads', 1, '默认本地存储');
