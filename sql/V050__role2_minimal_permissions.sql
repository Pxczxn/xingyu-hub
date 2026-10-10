-- V050: role2（普通后台角色）最小权限收紧 — Admin Security Gate Final Remediation
--
-- 背景（docs/admin-effective-permission-closure-2026-10-10.md）：
--   role2（"普通用户"）被授予 67 项权限，含 sys:user/role/menu/config/dept/post/dict
--   全套写、monitor:online:forceLogout、tool:gen:* 等系统管理级权限，构成权限提升路径
--   （可创建后台账号并修改权限归属）。本迁移将其收紧为只读 + 自助类权限。
--
-- 保留（16 项只读/自助）：sys:dept:list、sys:post:list、sys:dict:list、sys:notice:list、
--   sys:file:list、sys:chat:list、monitor:online:list、monitor:job:list、
--   monitor:loginlog:list、monitor:operlog:list、monitor:server:list/query、
--   monitor:apiAccess:list、monitor:druid:list、system:customer:list/query。
-- 撤销（51 项）：全部 add/edit/delete/test/remove/upload/forceLogout/import/code/preview
--   及 sys:user:*/sys:role:*/sys:menu:*/sys:config:* 全部、tool:gen:*、system:customer 写。
--
-- 回退：见文件末尾注释中的恢复 INSERT 模板（需按执行时实际 sys_menu 数据重建绑定）。
-- 影响：绑定 role=2 的账号将失去用户/角色/菜单/配置/代码生成等管理入口（前端菜单同步
--   收起，接口层由 @SaCheckPermission 拒绝）。

-- 撤销 role=2 的全部管理写权限与开发工具权限（按 permission 编码匹配，跨 menu id 生效）
DELETE rm FROM sys_role_menu rm
JOIN sys_menu m ON m.id = rm.menu_id
WHERE rm.role_id = 2
  AND m.permission IS NOT NULL AND m.permission != ''
  AND (
        m.permission LIKE '%:add'
     OR m.permission LIKE '%:edit'
     OR m.permission LIKE '%:delete'
     OR m.permission LIKE '%:remove'
     OR m.permission LIKE '%:test'
     OR m.permission LIKE '%:import'
     OR m.permission LIKE '%:code'
     OR m.permission LIKE '%:preview'
     OR m.permission LIKE '%:upload'
     OR m.permission = 'monitor:online:forceLogout'
     OR m.permission LIKE 'tool:gen:%'
     OR m.permission LIKE 'sys:user:%'
     OR m.permission LIKE 'sys:role:%'
     OR m.permission LIKE 'sys:menu:%'
     OR m.permission LIKE 'sys:config:%'
  );

-- 回退模板（谨慎使用：需确认 sys_menu 中对应 permission 行仍存在，menu_id 以执行时为准）：
-- INSERT INTO sys_role_menu (role_id, menu_id)
-- SELECT 2, m.id FROM sys_menu m
-- WHERE m.permission IN ('sys:user:add','sys:user:edit','sys:user:delete', /* ...原清单... */)
--   AND NOT EXISTS (SELECT 1 FROM sys_role_menu t WHERE t.role_id = 2 AND t.menu_id = m.id);
