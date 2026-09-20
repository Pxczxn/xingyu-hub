# xingyu_hub 数据库迁移

## 目录说明

| 文件 | 说明 |
|------|------|
| `V000`–`V018` | 星语社区 + 管理端基线 schema |
| `V019` | 删除 Mars 演示表（student、coder_banner、sys_chat_*） |
| `V020` | 清理 Mars 演示账号与审计日志，仅保留 `admin` |
| `V021` | 社区活动、指南 CMS、星系成员与内容 |
| `V022` | 群聊管理（公告/入群模式/申请）与用户端偏好存储 |
| `V023` | 消息附件字段、收藏消息、群聊入群申请查询优化 |
| `V024` | 推荐反馈、定时发布、协作邀请 |
| `V025` | 清理未使用的 system_parameter 种子项 |
| `V026` | 社区注册扩展字段（手机、角色、审核状态） |
| `V027` | 社区端固定使用 satoken 请求头（须与 Sa-Token 运行时配置一致） |
| `V028` | 话题介绍与推荐种子 |
| `V029` | 文章 v3 多维度状态（lifecycle / moderation 与 editorial workflow 分离） |
| `V030` | Topic 层级、别名治理与合并审计 |
| `V031` | P2 增长与生态（运营精选、开放 API Token） |
| `V032` | 管理端文件存储配置 |
| `V033` | 用户屏蔽、系列订阅、举报补充、星系入群申请 |
| `V034` | 消息撤回 |
| `V035` | 活动报名 |
| `V036` | creator_follow → user_follow（Phase 1） |
| `V037` | 索引优化（Phase 6） |
| `V038` | 探索导航体系（官方领域星图 + 个人探索 + 标签关联） |
| `V039` | 空间置顶文章（space_pinned_article） |
| `V040` | 文章封面图 |
| `V041` | 对齐 schema 与 migration baseline —— 补齐索引/唯一约束与注释漂移（当前最新迁移） |
| `rebuild.ps1` | 一键删库重建（开发环境） |

> 备注：部分迁移（如 `V029`、`V030`、`V031`、`V037`、`V040`）头部标注为「可重复执行」——列/索引/表已存在时会自动跳过，可安全重跑。
> 当前最新迁移为 **`V041__align_dev_schema_baseline.sql`**，新增迁移请从 `V042__*.sql` 起。

## 一键重建（推荐）

```powershell
cd sql
.\rebuild.ps1
```

默认连接：本地数据库账号（用户名取自 `scripts/local-db.env` 的 `DB_USERNAME`）/ 密码取自环境变量 `DB_PASSWORD`（本地可 `source scripts/local-db.env`）。
**仓库不保存任何可用密码**；缺失时脚本会在执行任何 SQL 之前直接退出。

重建后管理端账号：**admin / admin123**

## 注意

- **不要**将 Navicat「仅结构」导出文件直接导入已有库，会清空所有数据。
- 日常 schema 变更请新增 `V0xx__*.sql`，不要改已发布的迁移 checksum。
- 应用内 `xingyu.schema.migration.enabled` 在 dev 默认关闭；本地重建优先用 `rebuild.ps1`。
