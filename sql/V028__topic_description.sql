-- V028：话题介绍与推荐种子
SET NAMES utf8mb4;

ALTER TABLE `topic`
  ADD COLUMN `description` varchar(512) NULL COMMENT '话题介绍' AFTER `name`;

UPDATE `topic` SET `description` = '综合讨论与社区日常' WHERE `seed_key` = 'general';
UPDATE `topic` SET `description` = '官方公告与重要通知' WHERE `seed_key` = 'announcement';

INSERT IGNORE INTO `topic` (`id`, `seed_key`, `slug`, `name`, `description`, `status`) VALUES
('01900000-0000-7000-8000-000000000003', 'tech', 'tech', '技术', '编程、架构与工程实践', 'ENABLED'),
('01900000-0000-7000-8000-000000000004', 'design', 'design', '设计', '视觉、交互与产品设计', 'ENABLED'),
('01900000-0000-7000-8000-000000000005', 'startup', 'startup', '创业', '产品、增长与团队建设', 'ENABLED'),
('01900000-0000-7000-8000-000000000006', 'ai', 'ai', 'AI', '人工智能与应用探索', 'ENABLED'),
('01900000-0000-7000-8000-000000000007', 'opensource', 'opensource', '开源', '开源项目与社区协作', 'ENABLED'),
('01900000-0000-7000-8000-000000000008', 'reading', 'reading', '阅读', '书籍、文章与知识分享', 'ENABLED'),
('01900000-0000-7000-8000-000000000009', 'life', 'life', '生活', '日常、兴趣与生活方式', 'ENABLED');
