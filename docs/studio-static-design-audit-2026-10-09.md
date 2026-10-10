# Studio Static Design Audit Report

> 2026-10-09 · 只审计，不实施。15 条真实路由全量覆盖。
> 证据来源：源码结构审计 + 隔离 test 环境真实浏览器取证（7788 test 后端 + vite 7777，专用创作者账号 fixture，1440/390 双视口）。fixture 与临时进程已全部清理。

---

## 0. 审计环境与证据说明

- **浏览器取证**：test profile 后端（`xingyu_hub_test`）+ vite dev server（代理 7788），真实注册的专用创作者账号（5 篇文章覆盖 草稿/送审/已发布/回收站/版本历史 5 种状态、1 个含编排的系列、1 个分类、1 条协作邀请），localStorage 注入真实 satoken（test 库 captcha=false）。
- **已实测**：15 页中 14 页的 1440 桌面态 + 9 页的 390 移动态 + 保存闭环（真实键盘输入 → DB 回读一致）+ 越权 404 态 + 协作邀请生成全流程。
- **取证纠错声明**：编辑器保存链路初测曾误判"正文丢失"——实为审计脚本 `querySelector('textarea')` 误取摘要框（页面第一个 textarea 是 summary）。用 `data-editor-body-input` 选择器与真实键盘输入复测后确认 **MARKDOWN 与 RICH_TEXT 两模式保存均真实持久化**。此纠错过程本身就是"保存反馈真实可靠"的最强证据。
- **未验证项（明确标注，不以源码推断冒充）**：真实移动设备（仅 CDP 390 视口）、弱网/断网行为、真实第三方登录。

## 1. 十五页审计矩阵

| # | 页面 | 职责/主任务 | 状态覆盖（loading/empty/error/retry） | 390 移动端 | 主要发现 |
|---|---|---|---|---|---|
| 1 | /studio（Hub） | 入口枢纽，6 功能卡 + 写新文章 CTA | ——（静态聚合页） | ✅ 无溢出，卡片堆叠 | 结构清晰；无 per-入口动态计数（如"3 篇草稿"） |
| 2 | /studio/content | 内容管理：状态 tab + 列表 + 回收站 | ✅ 空态文案按 tab 区分；✅ 409 不可回收有拦截提示；✅ 懒加载回收站 | ✅ 无溢出 | **CB-1 计数/tab 契约错误（见 2.1）** |
| 3 | /studio/content/new | 空白新建 | ✅ 挂载不发请求；✅ /new 不被列表遮蔽 | ✅ | 工具栏完整（预览/保存/提交/模式/格式化/话题） |
| 4 | /studio/content/:id | 编辑草稿 | ✅ dirty 离开守卫；✅ 保存三态标签；✅ 409/404 文案；✅ IN_REVIEW 只读；✅ PUBLISHED 横幅 | ❌ **SB-1 横向溢出 285px（实测）** | 保存闭环实测可靠（两模式、真实键盘、DB 回读一致） |
| 5 | /studio/content/:id/versions | 版本列表 + 恢复 | ✅ 空历史诚实解释；✅ 恢复确认框；✅ IN_REVIEW 隐藏恢复 | ✅ | 诚实措辞（"发布时定格"、无正文预览）；恢复后需回编辑器查看 |
| 6 | /studio/analytics | 数据汇总 | ✅ 真实数字/真实 0 区分；✅ 失败不显示假横线 | ✅ | 口径观察：草稿卡 3 vs "尚未提交 2"（含回收站 DRAFT 篇目） |
| 7 | /studio/submissions | 投稿进展列表 | ✅ 五状态标签 + 每状态行动指引（去编辑/查看文章） | ✅ | 状态→文案映射准确（实测 已撤回/待审核/已通过） |
| 8 | /studio/submissions/:id | 投稿详情 + 撤回 | ✅ 仅 PENDING 可撤回；✅ 409/404；✅ 审核意见空态 | ✅ | 面包屑齐全 |
| 9 | /studio/series | 系列列表 | ✅ 空态引导 | ✅ | 与 content 页共用卡片骨架但信息密度不同，未见过度复用 |
| 10 | /studio/series/new | 创建系列 | ✅ slug 自动生成预览 | ✅ | — |
| 11 | /studio/series/:id/edit | 编辑系列 | ✅ 409 冲突刷新按钮；✅ 归档 vs 删除区分 | ✅ | — |
| 12 | /studio/series/:id/articles | 章节编排 | ✅ 空态 | ✅ | **CB-2 草稿章节显示"无标题文章"+裸 UUID（实测）**；无移除单篇控件（Product Debt） |
| 13 | /studio/collaboration | 生成邀请 | ✅ 能力边界披露 ×2；✅ 链接+有效期+复制 | ✅ | 诚实设计（"协作权限尚未实现"） |
| 14 | /studio/collaboration/accept | 确认邀请 | ✅ resolve 无效处理；✅ 邀请人/有效期展示 | ✅ | 一次导航被重定向 login（未复现，重试即正常——记观察项） |
| 15 | /studio/categories | 分类 CRUD | ✅ 409 重载；✅ 使用中标记；✅ 归档 vs 删除 | ✅ | 无排序控件（Product Debt，与 API 一致） |

补充实测：越权/不存在文章（/studio/content/:badId）→ "草稿不存在或无权编辑" + 返回路径 ✅。

## 2. 问题清单（按优先级）

### Contract Blocker（真实功能/数据契约错误）

- **CB-1 内容管理页"审核中"计数与 tab 恒空**：`content-list.ts:64-67` 的 `isReviewing` 只认 `REVIEW`/`REVIEWING`，而后端真实状态是 **`IN_REVIEW`**（ArticleStateSupport.EDITORIAL_IN_REVIEW）。实测：有 1 篇 IN_REVIEW 时计数卡显示 0、`?tab=reviewing` 显示"没有审核中的文章"。用户无法通过 tab 找到审核中的文章。
  最小修复：`isReviewing` 加入 `IN_REVIEW`（或以 ArticleStateSupport 常量为唯一事实源导出到前端）。附注：**"被退回" tab 恒空是同源且更深的契约问题**——后端驳回后 `article.status` 回 DRAFT，`listMine` 永远不会出现 RETURNED 状态，该 tab 数据源不存在，需产品决策（是否改由 submission 状态驱动）。
- **CB-2 系列编排页草稿章节无标题**：后端 `GET /me/series/{id}` 的 `chapters[].title` 对草稿章节返回 **null**（实测：已发布章节有标题、草稿章节 null），前端 `series-labels.ts:33` 回退"无标题文章"，页面再显示裸 UUID 作辅助信息（SeriesArticlesPage.tsx:127-128）。用户在编排页无法辨认自己的草稿。
  最小修复：后端组装 chapters 时对无正式版本的文章回退 `working_draft.title`（与 listMine 一致）；前端 UUID 辅助行建议降级为次要提示或移除。

### Static Design Blocker

- **SB-1 编辑器移动端横向溢出 285px**：390 视口下编辑器页 `scrollWidth - clientWidth = 285`（其余 9 个抽查页面全部 0/-15 正常）。核心创作页在手机上需横向滚动，保存按钮勉强可见。疑似 Markdown 模式行号列 + textarea 最小宽度未随视口收缩（未做根因定位——本轮只审计）。
  最小修复方向：编辑器内容区 `min-w-0`/行号列在窄屏隐藏或收窄；修复后需 390 实测回归。

### Design Improvement

- DI-1 内容列表行操作密度：编辑/版本历史/移入回收站 三个同视觉权重的文字按钮并排，"移入回收站"（危险操作）无颜色/分隔区分（后端已有 409 拦截兜底，但视觉优先级不符）。
- DI-2 Analytics 计数口径：顶部"草稿 3 篇"与正文"2 篇尚未提交审核的草稿"不一致（回收站中 status=DRAFT 的篇目被计入前者）——数字都真实，但同页两个口径易误读。
- DI-3 系列/内容/投稿列表共用卡片骨架，但各页 tab/计数/操作排布存在 2-3 种变体——可接受，建议在 Static Design Final Fix 时归并为 1-2 种模式。
- DI-4 Hub 页无动态概览（如各状态篇数）——功能缺失层面，非缺陷。

### Product Debt（明确不实现/尚未实现，非缺陷）

编辑器图片上传（占位，UI 已接好）；协作 accept 不落库（UI 双处诚实披露）；创作者直接发布（必须审核）；回收站永久删除与自动清理；分类排序；系列编排移除单篇控件。

## 3. 正面确认（审计中验证可靠的部分）

- 保存链路端到端真实：真实键盘输入 → 两模式 → DB 回读一致 → "已保存"反馈属实；lockVersion 递增正确。
- 状态机呈现与后端一致：IN_REVIEW 只读、PUBLISHED 横幅、五投稿状态文案准确。
- 空态/错误态/无权限态覆盖率高且文案诚实（含能力边界披露）；返回路径齐全（面包屑/返回按钮/404 返回创作中心）。
- a11y 基础良好：h1 层级、label 绑定、landmark 结构、跳转链接。
- 设计语言统一（语义 token/共享基础组件），未见硬编码色板或过度装饰；卡片复用适度未滥用。

## 4. 最小修复顺序建议

1. **CB-1**：`isReviewing` 加 `IN_REVIEW`（1 行 + 前端测试修正 mock 值）；"被退回"tab 需产品裁决（数据源改造）后单独处理。
2. **CB-2**：后端 chapters title 回退 working_draft.title（1 处组装逻辑）+ 前端 UUID 辅助行调整。
3. **SB-1**：编辑器 390 溢出修复 + 移动端回归（390 实测）。
4. DI-1/DI-2 随 Static Design Final Fix 一并处理。
