-- V038：探索导航体系（官方领域星图 + 个人探索 + 标签关联）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `explore_domain` (
  `id` varchar(36) NOT NULL COMMENT '领域 ID',
  `seed_key` varchar(64) NULL COMMENT '种子键（幂等）',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `name` varchar(128) NOT NULL COMMENT '显示名称',
  `description` varchar(512) NULL COMMENT '简介',
  `icon` varchar(64) NULL COMMENT '图标键',
  `parent_id` varchar(36) NULL COMMENT '父级星域',
  `domain_type` varchar(16) NOT NULL COMMENT 'SYSTEM / PERSONAL',
  `owner_user_id` varchar(36) NULL COMMENT '个人探索归属用户',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / PENDING / ARCHIVED',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_explore_domain_seed` (`seed_key`),
  UNIQUE KEY `uk_explore_domain_slug_owner` (`slug`, `owner_user_id`),
  KEY `idx_explore_domain_parent` (`parent_id`, `status`, `sort_order`),
  KEY `idx_explore_domain_owner` (`owner_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='探索领域（官方星图 + 个人探索）';

CREATE TABLE IF NOT EXISTS `user_explore_domain` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `domain_id` varchar(36) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_explore_domain` (`user_id`, `domain_id`),
  KEY `idx_user_explore_domain_user` (`user_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户探索方向';

CREATE TABLE IF NOT EXISTS `content_tag` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `normalized_name` varchar(128) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_content_tag_slug` (`slug`),
  KEY `idx_content_tag_normalized` (`normalized_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='内容标签';

CREATE TABLE IF NOT EXISTS `article_tag` (
  `article_id` varchar(36) NOT NULL,
  `tag_id` varchar(36) NOT NULL,
  `source` varchar(16) NOT NULL DEFAULT 'AUTHOR' COMMENT 'AUTHOR / AI / SEO',
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_article_tag_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章标签关联';

CREATE TABLE IF NOT EXISTS `domain_tag_relation` (
  `domain_id` varchar(36) NOT NULL,
  `tag_id` varchar(36) NOT NULL,
  PRIMARY KEY (`domain_id`, `tag_id`),
  KEY `idx_domain_tag_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='领域-标签关联';

CREATE TABLE IF NOT EXISTS `explore_domain_application` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `proposed_name` varchar(128) NOT NULL,
  `description` varchar(512) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_explore_domain_application_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='领域创建申请';

-- 官方星域（一级）
INSERT IGNORE INTO `explore_domain` (`id`, `seed_key`, `slug`, `name`, `description`, `icon`, `parent_id`, `domain_type`, `owner_user_id`, `status`, `sort_order`) VALUES
('01910000-0000-7000-8000-000000000001', 'star-tech', 'tech', '技术', '编程、架构与工程实践', 'code', NULL, 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000002', 'star-design', 'design', '设计', '视觉、交互与体验设计', 'palette', NULL, 'SYSTEM', NULL, 'ACTIVE', 2),
('01910000-0000-7000-8000-000000000003', 'star-create', 'create', '创作', '写作、影像与内容创作', 'pen', NULL, 'SYSTEM', NULL, 'ACTIVE', 3),
('01910000-0000-7000-8000-000000000004', 'star-science', 'science', '科学', '自然、宇宙与理性探索', 'telescope', NULL, 'SYSTEM', NULL, 'ACTIVE', 4),
('01910000-0000-7000-8000-000000000005', 'star-learn', 'learn', '学习', '学习方法与成长经验', 'book', NULL, 'SYSTEM', NULL, 'ACTIVE', 5);

-- 技术子领域
INSERT IGNORE INTO `explore_domain` (`id`, `seed_key`, `slug`, `name`, `description`, `icon`, `parent_id`, `domain_type`, `owner_user_id`, `status`, `sort_order`) VALUES
('01910000-0000-7000-8000-000000000101', 'domain-frontend', 'frontend', '前端开发', 'Web 与跨端界面工程', 'layout', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000102', 'domain-backend', 'backend', '后端开发', '服务、接口与系统架构', 'server', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 2),
('01910000-0000-7000-8000-000000000103', 'domain-mobile', 'mobile', '移动开发', 'iOS、Android 与跨端', 'smartphone', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 3),
('01910000-0000-7000-8000-000000000104', 'domain-ai', 'ai', 'AI 与人工智能', '模型、应用与智能产品', 'sparkles', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 4),
('01910000-0000-7000-8000-000000000105', 'domain-database', 'database', '数据库', '存储、查询与数据工程', 'database', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 5),
('01910000-0000-7000-8000-000000000106', 'domain-cloud', 'cloud', '云计算', '云原生、部署与基础设施', 'cloud', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 6),
('01910000-0000-7000-8000-000000000107', 'domain-devops', 'devops', 'DevOps', '交付、运维与工程效率', 'workflow', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 7),
('01910000-0000-7000-8000-000000000108', 'domain-security', 'security', '安全技术', '安全攻防与合规', 'shield', '01910000-0000-7000-8000-000000000001', 'SYSTEM', NULL, 'ACTIVE', 8);

-- 设计子领域
INSERT IGNORE INTO `explore_domain` (`id`, `seed_key`, `slug`, `name`, `description`, `icon`, `parent_id`, `domain_type`, `owner_user_id`, `status`, `sort_order`) VALUES
('01910000-0000-7000-8000-000000000201', 'domain-ui', 'ui-design', 'UI 设计', '界面视觉与组件体系', 'brush', '01910000-0000-7000-8000-000000000002', 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000202', 'domain-product', 'product-design', '产品设计', '需求、流程与产品策略', 'box', '01910000-0000-7000-8000-000000000002', 'SYSTEM', NULL, 'ACTIVE', 2),
('01910000-0000-7000-8000-000000000203', 'domain-ixd', 'interaction-design', '交互设计', '交互逻辑与体验细节', 'mouse-pointer', '01910000-0000-7000-8000-000000000002', 'SYSTEM', NULL, 'ACTIVE', 3),
('01910000-0000-7000-8000-000000000204', 'domain-ux', 'ux', '用户体验', '用户研究与体验评估', 'heart', '01910000-0000-7000-8000-000000000002', 'SYSTEM', NULL, 'ACTIVE', 4);

-- 创作 / 科学 / 学习子领域（精选）
INSERT IGNORE INTO `explore_domain` (`id`, `seed_key`, `slug`, `name`, `description`, `icon`, `parent_id`, `domain_type`, `owner_user_id`, `status`, `sort_order`) VALUES
('01910000-0000-7000-8000-000000000301', 'domain-writing', 'writing', '写作', '长文、专栏与叙事表达', 'file-text', '01910000-0000-7000-8000-000000000003', 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000302', 'domain-photo', 'photography', '摄影', '影像记录与视觉叙事', 'camera', '01910000-0000-7000-8000-000000000003', 'SYSTEM', NULL, 'ACTIVE', 2),
('01910000-0000-7000-8000-000000000303', 'domain-video', 'video', '视频创作', '剪辑、短视频与影像表达', 'video', '01910000-0000-7000-8000-000000000003', 'SYSTEM', NULL, 'ACTIVE', 3),
('01910000-0000-7000-8000-000000000401', 'domain-cosmos', 'cosmos', '宇宙探索', '天文、航天与宇宙观', 'orbit', '01910000-0000-7000-8000-000000000004', 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000402', 'domain-math', 'math', '数学', '数学思想与应用', 'sigma', '01910000-0000-7000-8000-000000000004', 'SYSTEM', NULL, 'ACTIVE', 2),
('01910000-0000-7000-8000-000000000501', 'domain-study', 'study-methods', '学习方法', '效率、记忆与知识管理', 'lightbulb', '01910000-0000-7000-8000-000000000005', 'SYSTEM', NULL, 'ACTIVE', 1),
('01910000-0000-7000-8000-000000000502', 'domain-growth', 'skill-growth', '技能成长', '职业发展与能力提升', 'trending-up', '01910000-0000-7000-8000-000000000005', 'SYSTEM', NULL, 'ACTIVE', 2);

-- 标签种子
INSERT IGNORE INTO `content_tag` (`id`, `slug`, `name`, `normalized_name`) VALUES
('01920000-0000-7000-8000-000000000001', 'java', 'Java', 'java'),
('01920000-0000-7000-8000-000000000002', 'springboot', 'SpringBoot', 'springboot'),
('01920000-0000-7000-8000-000000000003', 'redis', 'Redis', 'redis'),
('01920000-0000-7000-8000-000000000004', 'backend', '后端', '后端'),
('01920000-0000-7000-8000-000000000005', 'react', 'React', 'react'),
('01920000-0000-7000-8000-000000000006', 'frontend', '前端', '前端'),
('01920000-0000-7000-8000-000000000007', 'ai', 'AI', 'ai'),
('01920000-0000-7000-8000-000000000008', 'llm', '大模型', '大模型'),
('01920000-0000-7000-8000-000000000009', 'python', 'Python', 'python'),
('01920000-0000-7000-8000-000000000010', 'langchain', 'LangChain', 'langchain'),
('01920000-0000-7000-8000-000000000011', 'ui', 'UI', 'ui'),
('01920000-0000-7000-8000-000000000012', 'ux', 'UX', 'ux'),
('01920000-0000-7000-8000-000000000013', 'writing', '写作', '写作'),
('01920000-0000-7000-8000-000000000014', 'photography', '摄影', '摄影'),
('01920000-0000-7000-8000-000000000015', 'cosmos', '宇宙', '宇宙'),
('01920000-0000-7000-8000-000000000016', 'devops', 'DevOps', 'devops'),
('01920000-0000-7000-8000-000000000017', 'database', '数据库', '数据库'),
('01920000-0000-7000-8000-000000000018', 'security', '安全', '安全');

-- 领域-标签关联
INSERT IGNORE INTO `domain_tag_relation` (`domain_id`, `tag_id`) VALUES
('01910000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000001'),
('01910000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000002'),
('01910000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000003'),
('01910000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000004'),
('01910000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000005'),
('01910000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000006'),
('01910000-0000-7000-8000-000000000104', '01920000-0000-7000-8000-000000000007'),
('01910000-0000-7000-8000-000000000104', '01920000-0000-7000-8000-000000000008'),
('01910000-0000-7000-8000-000000000104', '01920000-0000-7000-8000-000000000009'),
('01910000-0000-7000-8000-000000000104', '01920000-0000-7000-8000-000000000010'),
('01910000-0000-7000-8000-000000000201', '01920000-0000-7000-8000-000000000011'),
('01910000-0000-7000-8000-000000000204', '01920000-0000-7000-8000-000000000012'),
('01910000-0000-7000-8000-000000000301', '01920000-0000-7000-8000-000000000013'),
('01910000-0000-7000-8000-000000000302', '01920000-0000-7000-8000-000000000014'),
('01910000-0000-7000-8000-000000000401', '01920000-0000-7000-8000-000000000015'),
('01910000-0000-7000-8000-000000000107', '01920000-0000-7000-8000-000000000016'),
('01910000-0000-7000-8000-000000000105', '01920000-0000-7000-8000-000000000017'),
('01910000-0000-7000-8000-000000000108', '01920000-0000-7000-8000-000000000018'),
('01910000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000001'),
('01910000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000007'),
('01910000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000016');
