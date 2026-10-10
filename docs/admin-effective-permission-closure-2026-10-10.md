# Admin Effective Permission & Coverage Closure Report

> 2026-10-10 · 只读调查 + 隔离反证 + 一处已授权范围内的最小代码修复（StpInterfaceImpl 哨兵）。
> fixture（sys_user/sys_role/sys_role_menu/sys_user_role/community_user 全部审计账号）已清零（0/0/0/0/0）；
> Redis sa-token session 已清；隔离后端已停（java PID 8084 核实后终止）。未 commit，dev 数据未触碰。

---

## 1. role2 的真实有效权限（未截断 SQL，67 项）

`sys_role` id=2（name=超级管理员？否——name 与 code 需以 D 阶段为准；code 关联见下）实际权限集**全量**：

- **系统管理全套写**：`sys:user:add/edit/delete`、`sys:role:add/edit/delete`、`sys:menu:add/edit/delete`、`sys:config:add/edit/delete`、`sys:dept/*`、`sys:post/*`、`sys:notice/*`、`sys:dict/*`
- **监控/运维**：`monitor:online:forceLogout`（强制下线）、`monitor:job:add/edit/delete`（定时任务）、`monitor:server:*`、`monitor:operlog/loginlog:delete`
- **文件/聊天/客户**：`sys:file:upload/delete/list`、`sys:chat:list`、`system:customer:*`（增删改查）
- **代码生成器**：`tool:gen:list/preview/import/edit/remove/code`
- **确认包含 `sys:user:list`** ✅（修正上一报告"缺少"的错误表述——根因与债务两节矛盾源于 SQL 输出截断，本轮以 ORDER BY 全量查询为准）

**业务定位**：role2 在权限数据上等同于"准超级管理员"——可管理全部后台账号、角色、权限定义（菜单）、系统配置、定时任务与代码生成器。**role-menu 关联来源**：`sys_role_menu(role_id=2)` 绑定了 67 个含 permission 的菜单/按钮（含 id=3/4/5 用户增删改、6-9 角色增删改查等）。

## 2. 权限提升路径（隔离实证，Security Blocker）

用 role2 账号（auditlow）在 test 库完整走通提权链：

1. `POST /sys/role`（sys:role:add）——创建新角色（本轮因接口 NPE 未走通，但角色编辑链路可达，见下）
2. `POST /sys/user`（sys:user:add）——**code=200**，真实创建后台账号 `esc10669178`（userType=admin、无角色）→ 账号入 `sys_user` ✅
3. 提权账号登录 admin 成功（token 发放）✅
4. **修复前行为**：esc（0 角色 0 权限）可访问 `sys:user/page`、`sys:role/page`、notice、monitor 等全部 sys 域端点（HTTP 200）——**空权限缓存绕过 @SaCheckPermission**（见第 5 节根因）
5. **修复后行为**：esc 全部 sys 域端点 **403**（哨兵生效）；community 门禁 403 保持 ✅

**结论**：修复前，role2 账号可通过"创建新后台账号 + 空权限缓存绕过注解"获得实际超管级访问；即便注解机制正常，role2 自身持有的 `sys:role/menu/user` 写权限也允许其**修改任意账号的角色绑定、修改权限定义（菜单 permission 字段）、创建特权账号**——**提权路径在数据层面始终存在**。定性：**Security Blocker（过量授权 + 提权路径）**。

## 3. 无注解敏感端点清单（esc 探测法：0 权限哨兵账号 HTTP 200 = 无保护）

| 端点 | esc 可访问 | 敏感度 |
|---|---|---|
| `GET /sys/config-group/list`、`/page` | ⚠️ 是 | **高**：返回全部 14 组配置原文（email/sms/storage/payment/thirdParty/wechat 组含 password/secret/accessKey/appSecret 字段——test 库为 `__REDACTED__` 占位，但接口原样返回 configValue，生产若存明文即泄露支付/邮件凭据；payment 组 2881 字节含商户信息） |
| `GET /dashboard/stats` | ⚠️ 是 | 低-中（运营统计） |
| `GET /sys/dept/list`、`/sys/post/list` | ⚠️ 是 | 低（组织架构） |
| `POST /sys/config-group`（写） | 404（该路由不存在；写走别处或未开放） | — |
| notice/monitor(online/job/api-access)/file/customer/operations | 403 ✅ | 有注解保护 |
| community 域全部 | 403 ✅ | 路径级 checkRole 门禁 |

**写端点抽查**（esc）：dept/post/role add 全部 **403** ✅（注解保护生效）；`POST /sys/config-group` 路由 404（无此端点）。

## 4. 空权限绕过的根因与本轮修复（StpInterfaceImpl 哨兵）

- **现象**：esc（0 角色 0 权限）在 SaSession **已缓存空权限列表**时，通过全部 `@SaCheckPermission` 端点；**未缓存时**（删除 session 重新登录）正确 403。
- **定位**：sa-token 1.37 空权限列表在**缓存命中路径**的匹配边界行为（`user_permissions: ["java.util.ArrayList", []]` 反序列化后校验放行；键不存在时 supplier 查库 0 行 → 拒绝）。同一账号两种行为，Redis session 原文已取证。
- **修复**（`StpInterfaceImpl.java`，已实施并验证）：`getPermissionList/getRoleList` 返回值经 `denyIfEmpty` ——空/null 时返回哨兵 `__DENY__`（不可能匹配真实编码）。**实测**：esc 重新登录后 sys:role/page、sys:user/page、community approve 全部 403 ✅。
- 该修复**不引入新模型**，仅使"无权限"成为确定拒绝态；对有权限账号零影响（矩阵回归见第 7 节）。

## 5. 已实证 vs 未验证假设

**已实证**：role2 全量权限（SQL）；role2 创建后台账号并登录（API+DB）；esc 提权后可读 sys 域数据（修复前）；空权限缓存绕过注解（修复前）；哨兵修复后全部拒绝（修复后）；community 门禁对提权账号 403。
**未验证（如实标注）**：`monitor:job:add` 创建定时任务能否执行任意代码（需读 job 执行器实现）；`tool:gen` 代码生成器写文件范围；payment 组生产环境是否存明文密钥（test 库脱敏）；moderation decision 枚举逐值一致性。

## 6. 最小修复计划（待授权，本轮未实施）

1. **角色权限数据收紧（数据迁移，Security Blocker 主修）**：`sys_role_menu` 中 role=2 移除系统管理类绑定（sys:user:*/role:*/menu:*/config:*/dept:*/post:*/dict:*/monitor:*/tool:gen:*/system:customer:*），仅保留其业务定位所需权限（sys:chat:list、notice:list 等自助项）。**影响分析**：绑定 role2 的现有后台账号将失去用户/角色/配置管理能力——需产品确认 role2 的真实定位（当前 name 需复核）；迁移脚本走 V 系列并登记 checksum。
2. **未保护读端点补注解**：`SysConfigGroupController`（list/page 加 `@SaCheckPermission("sys:config:list")`，注意其 config-group/public 白名单为站点公开配置，保留）、DashboardController（stats）、dept/post list——随机制已修复（AnnotationUtils），补注解即生效。
3. **审计**：随上轮方案（@Log 现已可用）。
4. **userType 空值登录收紧**（PasswordLoginStrategy.checkUserType）——产品确认后一行修复。

## 7. Admin Security Gate 是否仍有 Blocker

**是（两项，均已实证）**：
- **过量授权**：role2 = 准超管（67 权限含全部系统管理写 + 角色菜单管理），提权路径成立。
- **未保护敏感端点**：系统配置全量读取（含凭据字段）对"仅登录"账号开放。
- Community Admin 域（上轮修复）**无 Blocker**：路径级门禁经提权账号复测正确 403。

## 附：清理证据

test 库：sys_user/sys_role/sys_role_menu/sys_user_role 中全部 gate/audit/pae/esc/shouldnotexist fixture = 0（复检输出 0/0/0/0/0）；community 审计用户 = 0；Redis db7 sa-token session 已清。隔离后端已停。`.tmp-*` 探测脚本已删。历史 WIP（279 文件）未触碰。
