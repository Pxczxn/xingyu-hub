-- V025：清理未使用的 system_parameter 种子项
SET NAMES utf8mb4;

DELETE FROM `system_parameter`
WHERE (`namespace`, `param_key`) IN (
    ('COMMUNITY', 'registration.open'),
    ('COMMUNITY', 'review.required'),
    ('SYSTEM', 'mail.provider'),
    ('SYSTEM', 'oss.provider')
);
