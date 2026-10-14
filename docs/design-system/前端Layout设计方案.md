# 星语 Hub 前端 Layout 设计方案

> 依据：《信息优先级.md》（2026-10-13）
> 范围：xingyu-web 主站全部路由的前端布局规划——板块划分、排列顺序、视觉权重、响应式行为。
> 前提：Web 为主战场；不假设后端未提供的能力。
> 范围扩展（2026-10-13）：初版自我限定"只谈布局骨架与信息组织，不涉及视觉皮肤细节"**已被取代**。本文档现在同时承担三项横向工程——**动效体系 / 插图体系 / 表面细化**（见 §6.2），并与布局批次同批落地。
> 说明：文档中的方框示意仅作参考，本方案在其基础上按可落地性重新设计，与现有代码衔接处均标注文件依据。
> 状态：**批次 01–08 已全部落地（2026-10-13）**。逐节落地状态见 §六 批次表与各节 ✅ 标记；实施中对初版规划的偏离一律在各节「实施记录」中留痕，并汇总于文末修订记录。

---

## 一、布局总则：把信息优先级翻译成视觉权重

### 1.1 四层优先级 → 四档布局待遇

| 优先级 | 业务定义 | 布局待遇 | 视觉手段 |
|---|---|---|---|
| P0 | 用户来这个页面的目的 | 首屏主区、主栏，第一视觉落点 | 最大尺寸、最高对比、无遮挡、无折叠 |
| P1 | 关键操作与决策信息 | 紧邻 P0：标题旁 / 卡片内 / 工具栏 / 身份头 | 中等尺寸、明确按钮、位置固定 |
| P2 | 相关辅助信息 | 侧栏（rail）或主内容之后 | 小尺寸、次要色、可扫读 |
| P3 | 装饰、教育、低频 | 折叠 / 页脚 / 独立页 / 后置 | 低对比、收起、不与 P0 争首屏 |

三条裁决机制（用于评审每一个页面）：

1. **首屏裁决**：桌面 900px 视口内必须出现 P0；P3 不得把 P0 推出首屏（首页欢迎区、星系教学区是典型违规点）。
2. **单主任务**：一个页面只允许一个 P0 区域；第二个"想突出的东西"要么降为 P1，要么拆页 / 进 tab。
3. **权重来自业务**：尺寸与对比度由优先级决定，不由组件习惯决定——封面、Hero、装饰图默认不是主角。

### 1.2 五条长期规则的布局落地

| 规则（来自文档） | 布局动作 |
|---|---|
| 一个页面只有一个主要任务 | 主栏只放唯一 P0；多任务走 tab 或独立路由 |
| 不为复用统一骨架 | 六种页面语言 = 六类骨架（见 §三），只统一基础组件与 token |
| 首屏展示价值，不解释价值 | 欢迎/说明区 ≤160px；首屏必须见到内容 / 团队 / 作品 |
| 没数据时重组页面 | 空态用 PageState 引导操作；禁止占位卡片矩阵撑版面 |
| 视觉权重来自业务意义 | 封面降级为缩略图；状态、身份、正文升权 |

---

## 二、全局骨架体系

### 2.1 Shell 沿用（xingyu-web 现状）

- sticky header：Logo + 7 项主导航 + 搜索 + 操作区，断点 `lg`（`AppLayout.tsx:331`）；
- 主容器 `.content-shell`：max-width 1200px（`globals.css:102-105`）；
- 页面内容经 `<main id="main">`，footer 全站统一。

**结论：Shell 不动。** 本方案的全部改动发生在 main 内部；唯一例外是编辑器页（§3.6），它使用独立全宽布局。

### 2.2 九套页面骨架

六种"页面语言"在布局层落为九套可复用骨架（多出的三套服务工具类页面）：

| # | 骨架 | 栅格参数 | 服务页面 |
|---|---|---|---|
| S1 | 内容流 | 主栏 `minmax(0,1fr)` + rail 320px | 首页、话题详情、通知 |
| S2 | 探索网格 | 全宽 bento（12 列，差异权重） | 发现页 |
| S3 | 广场网格 | 筛选条 + 2~3 列卡片网格 | 话题/系列/星系/创作者广场、搜索、活动 |
| S4 | 身份详情 | 全宽身份头 + tab + 主栏/侧栏 | 星系详情、个人主页、系列详情 |
| S5 | 沉浸阅读 | 正文 680~720px + 目录 rail 240px | 文章详情、公告、指南、系列阅读 |
| S6 | 会话 | 320px 列表 + `flex` 聊天区 | 私信 |
| S7 | 工作台 | 200~240px 左导航 + 主区 | 创作中心、设置、我的内容 |
| S8 | 居中窄栏 | `max-w-md` / `2xl` / `4xl` 三档 | 认证、表单、引导、结果页 |
| S9 | 状态优先 | 状态卡 + 时间线/进度 | 举报、申诉、审核、投稿状态 |

### 2.3 路由 → 骨架全量映射

| 路由 | 骨架 | 备注 |
|---|---|---|
| `/` 首页 | S1 | rail = 热门话题 / 创作者 / 活动 |
| `/discover` 发现 | S2 | 全站唯一 bento |
| `/search` 搜索 | S3 | 列表密度高于广场 |
| `/topics`、`/series`、`/galaxies`、`/creators` | S3 | 广场统一模式 |
| `/topics/:slug` 话题详情 | S1（轻身份头） | 与星系区分：无成员体系 |
| `/galaxies/:slug` 星系详情 | S4 | 全站身份头最重 |
| `/u/:username` 个人主页 | S4 | 作品流 tab |
| `/articles/:articleId` 文章详情 | S5 | 右侧目录 |
| `/series/:seriesId` 系列详情 | S4 变体 | 主栏 = 章节目录 |
| `/series/:seriesId/read` 系列阅读 | S5 变体 | 左侧章节导航 |
| `/collections/:id` 收藏夹 | S3 | 内容列表 |
| `/moments`、`/moments/:id` | S1 / S3 | 轻密度卡片 |
| `/events`、`/events/:eventId`、`/submit` | S3 + S9 | 状态优先 |
| `/me/*`（除 galaxies） | S7 轻量 | 页头 + 列表 |
| `/me/galaxies` 我的星系 | S3 | 已加入列表 |
| `/messages/*` | S6 | 独立双栏 |
| `/notifications` | S1 变体 | 未读分组 |
| `/studio/*` | S7 | 编辑器全宽独立 |
| `/settings/*` | S7 | 左导航 + 表单 |
| `/onboarding` | S8 | 步骤式 |
| `/login`、`/register` 等 | S8 | 窄 / 宽两档 |
| `/announcements`、`/guide`、`/rules` | S5 | 阅读模式 |
| `/reports`、`/appeals` | S9 | 状态优先 |
| 404 | S8 | 单卡片 |

---

## 三、六种核心页面语言（详细规划）

### 3.1 首页 —— 内容流（S1）✅ 批次 01 已达标（2026-10-13 复核）

**改造要点**：保留"内容流 + 右侧社区栏"骨架，压缩欢迎区，确保首屏见内容。

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 紧凑欢迎条（身份语 + 推荐/关注切换 + 继续阅读） | P1（切换/继续阅读）、P3（身份语） | 总高 ≤140px；切换用 segmented 控件；继续阅读为带进度的横条（有则显示） |
| 2 | 内容流 feed | **P0** | 主栏单列卡片；首屏内至少露出 2 张卡片头部 |
| 3 | 热门话题 | P2 | rail 第一块 |
| 4 | 推荐创作者 | P2 | rail 第二块 |
| 5 | 社区活动 | P2 | rail 第三块 |

**呈现细节**
- 卡片内部优先级：标题 > 摘要（2 行截断）> 作者/时间 > 互动数据；
- 欢迎条与 feed 之间不加分隔大标题，避免额外高度；
- 首屏预算：header ~64px + 欢迎条 ≤140px + 卡片 ~200px ⇒ 900px 视口可见 ≥2 张卡片。

**响应式**：<1024px 时 rail 移到 feed 之后（或收为"探索更多"折叠区）。

**代码衔接（批次 01 已落地，2026-10-13 复核）**：欢迎区现为 `components/shared/PageMasthead`（原 `features/home/components/HomeMasthead` 已删除，见 §七.4）；栅格保持 `md:grid-cols-[minmax(0,1fr)_320px]`。

**实测欢迎条高度**（按 `tokens.css` / `globals.css` 计算，非估值）：

| 状态 | 组成 | 高度 |
|---|---|---|
| 访客 | eyebrow 16.5 + `mt-2.5` 10 + `text-display` 35 + `mt-2` 8 + `lede` 24 | **约 94px** |
| 登录 | 无 eyebrow，仅 `text-title` 18 × 1.4 | **约 25px** |

均在 ≤140px 预算内。feed 卡片层级（标题 > 摘要 > 作者/时间 > 互动数据）与"时间戳刻意不渲染"亦已就位，**故批次 01 无剩余改造动作**。

### 3.2 发现页 —— 探索（S2）✅ 批次 02 已落地（2026-10-13）

**改造要点**：内容前置。原顺序 `DiscoverHero → ExploreTopics → DiscoverFocusGrid` 已调整为：**说明行 → 精选内容 → 探索入口**。

| 序 | 板块 | 优先级 | 呈现方式 | 落地状态 |
|---|---|---|---|---|
| 1 | 页面说明行 | P3 | 无表面 `PageMasthead`：eyebrow + 标题 + 一句话 | ✅ 实测约 94px |
| 2 | 精选内容 | **P0** | 差异权重网格（见下） | ✅ 沿用已有 `DiscoverFocusGrid` |
| 3 | 探索入口 | P2 | 一行 chips（话题） | ✅ `ExploreTopics` 已降级 |
| 4 | 热门话题引导 | P2/P3 | 页尾或并入入口行 | ✅ 由第 3 行置于页尾达成 |

#### 实施记录（与初版规划的四处偏离）

**① 说明行高度：原写"≤80px"是未经验证的估值，实测约 94px。**
`PageMasthead` 访客态 = eyebrow 16.5 + `mt-2.5` 10 + 标题 `text-display` 35 + `mt-2` 8 + 描述 `lede` 24 ≈ 94px，与首页完全一致。此处不再单列一个更小的数字——**两页同高本身就是要的结果**，否则"发现页比首页更紧凑"会变成一个没有理由的差异。

**② 未新建 12 列 bento 网格。**
初版规划要求"行 1：大卡 8 列 + 次重点 4 列；行 2：三张各 4 列"。实测现有 `DiscoverFocusGrid` **已经是差异权重**：`lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]`，主卡 + 右侧纵向次级堆叠（`items-stretch` + `grid-rows-2`），且——

- 由服务端 `featured` 标记驱动，**不是**由数组下标推断（早期 `items[0]` / `items[1..3]` 的写法已修）；
- 对 0 / 1 / 2 / 3+ 个精选有完整降级：0 个退回普通网格（不硬凑一个"主焦点"）、1 个单列满宽、2 个主+一副、3+ 个其余落到 `更多内容` 尾网格。

按 §六 纪律"已有正确骨架的页面只调比例、入口位置与无效留白，不推倒重做"，把 1.5fr/1fr 改写成 8 列/4 列只是换写法，收益不抵回归风险。**本节的"差异权重"目标已由现有组件达成，`BentoGrid` 不新建。**

**③ 探索入口只呈现话题，不含创作者与系列。**
初版写"话题、创作者、系列"。当前 `DiscoverPage` 只调用 `topicsApi.getTopics()`，没有创作者/系列的对应数据源。按 §八 纪律不画无数据的入口，故本行只有话题 chips。

**④ 探索入口置于 feed 的「加载更多」之后，而非紧贴内容之后。**
读者仍在浏览时应先遇到「加载更多」，而不是一个离开本页的出口；滚过它的读者才表示"这里看完了"，此时给出话题才成立。另外，**feed 为空时本行是页面上唯一的去处**——空状态 + chips 一起避免了死路，这也是该行在 loading/error/empty 三个分支中都不被卸载的原因。

**话题块由卡片降级为 chips（本批唯一的视觉改动）**
- 去掉 `min-w-[150px]` 卡片轨道、`bg-card`、`rounded-lg`、`px-4 py-3`；
- 改用代码库已有的**纯边框 pill** 语言：`rounded-full border border-border/70 px-3 py-1.5`（同 `MySubmissionsPage` / `SubmissionDetailPage` 的既有写法），无填充、无阴影；
- 标题由 `text-lg` 降为 `text-sm`，不再与 `发现内容` / `更多内容` 这两个**真正的 feed 分区**竞争视觉权重；
- `N 篇内容` 保持**可见**而非折进 `aria-label`——它正是区分"值得点开"与"空话题"的信号，chips 也因此过滤 `contentCount > 0`；
- 错误态由带边框的 `bg-card/70` 盒子改为一行陈述，理由是**一个 P2 出口行的失败不应该画出一个比它替代的 chips 更重的表面**；文案「探索方向暂时无法加载。」未变。

**与首页的区分（本页核心命题）**
- 首页 = 时间流、统一卡片、无权重差异；发现 = 编辑式、差异权重、有明显"被推荐"感；
- 首页回答"现在看什么"，发现回答"还有什么值得探索"。

**响应式**：<1024px 主卡与次级堆叠合并为单列（由 `lg:` 前缀自然完成，无需额外断点）；chips 行 `flex-wrap` 自动换行，长话题名由 `max-w-full` + `min-w-0 truncate` 兜底，不再依赖固定 150px 轨道。

**代码衔接**：`DiscoverPage` 顺序已调整；`DiscoverHero.tsx` **已删除**（其全部内容就是 `PageMasthead` 的三个 props）；`ExploreTopics.tsx` 已降级为 chips 行。契约全部保留：`discover-topics-list`、`/topics/:slug` 链接、`查看全部话题`、错误文案、`h1 发现`。

### 3.3 话题 —— 讨论聚合（S3 + S1 轻身份头）✅ 批次 04 已落地（2026-10-13）

**话题广场 `/topics`**

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 页头 | P3 | 标题 + 一句话 |
| 2 | 筛选条（搜索） | P1 | sticky 于 header 之下 |
| 3 | 话题卡片网格 | **P0** | 2~3 列；卡片 = 名称 + 简介 + 内容数 + 关注 |
| 4 | 引导说明 | P3 | 页尾一行或折叠 |

卡片重点：**名称与内容数**（一眼判断活跃度）；关注按钮在卡片右下，可点但不抢。

**话题详情 `/topics/:slug`**

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 话题身份头 | P1 | ≤160px：名称 + 简介 + 关注 + 最新/热门切换 |
| 2 | 讨论内容流 | **P0** | 主栏 |
| 3 | 活跃创作者 | P2 | 右 rail |

**与星系的职责区分**：话题无成员体系、无 tab 多页、无"加入"概念——身份头保持轻量，只有关注。

#### 实施记录（与初版规划的两处偏离）

**① 筛选条只有搜索，没有分类 chips。**
`Topic` 实体没有分类字段——后端没有这一维的数据源。按 §八 纪律「筛选器只放真实能力，不画虚假 tab」，本行收窄为搜索一项。

**② 关注按钮回到卡片右下（一条过时禁令被证据推翻）。**
旧代码注释记「关注端点 404」，该缺陷已于 2026-10-10 修复：`SocialService` 曾硬编码 `status=ENABLED`，而话题状态是 `ACTIVE`，两者永不匹配。后端现有 `TopicFollowIntegrationTest` 钉死闭环，`CommunityAuthInterceptor` 对 `/api/v1/topics` 整段走可选认证，列表端点会带上 viewer 的 `following`。**`topics-page.test.tsx` 里原有一条断言「页面无关注按钮」的禁令测试因此失效**，改为三条正向测试。关注状态集中由 `TopicsPage` 持有，卡片只负责渲染。

**搜索从页头搬出，成为独立 sticky 筛选条（本批唯一的层级改动）**
- 它原本是 `TopicsHero` 里的一块，和标题、描述共用同一张横幅卡。问题不在外观而在层级：「过滤整个列表」这个动作读起来像标题的附属说明；
- 位置 `lg:top-24`（96px）与 `TopicHeader` / `ArticleDetailPage` / `RulesPage` 同值——shell header 是 `sticky top-0 z-30`，这是给它留的固定偏移；
- 筛选条本体是 `TopicsFilterBar.tsx`，三个实现细节各对应一个会踩的坑（理由见该文件头注释）：`type="text"` 而非 `type="search"`（后者映射 `searchbox`，会让既有 `getByRole("textbox", …)` 失配）；不设第二个 `role="status"`（空结果块已用，同页会二义）；`bg-card` 是 sticky 的必需项而非装饰（半透明会让滚动中的卡片从底下透出）；
- 清除按钮跟随搜索框，而不是放在 section 的 action 里——两者是同一件事，分开会让人先滚回列表标题才能取消过滤。

**卡片网格从「分隔线列表行」改成真正的卡片网格。**
间距由分隔线布局的 `gap-y-1` 换成卡片网格的 `gap-3`；入场用 `staggerDelay` 错峰。

**页尾补回一行「如何开始？」引导（P3）**，与星系广场同构；搜索态不出现——正在搜索的人不需要被教怎么开始。

**页头保持最轻**：只有 eyebrow、标题和一句话。本页没有数据要展示、也没有本页独有的动作（关注分散在每张卡片上），不加东西就是执行「页头 P3」这个定级。

### 3.4 星系 —— 团队共同体（S3 + S4）✅ 批次 03 已落地（2026-10-13）

**星系广场 `/galaxies`**

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 我的星系条（登录后） | P1 | 横向 3~5 个快捷进入；未登录隐藏 |
| 2 | 搜索 / 筛选 | P1 | 一行 |
| 3 | 星系卡片网格 | **P0** | 2~3 列 |
| 4 | 教学区 | P3 | 页脚两行文本（原为独立大区块，已压缩） |

**星系卡片信息结构（本页最重要的设计）**

```
[ 名称 + 认证标识 ]      ← 名称与官方徽章同行，最高对比
[ 一句话定位（简介）]    ← 必须有；缺失时整行不渲染，不摆占位文案
[ 成员数 ]               ← 接口提供才渲染（无则省略整行，不显示 0）
[ 查看星系 → ]           ← 明确出口
```

原则：用户需要一眼判断"这是什么团队、适不适合我"，而不是被插画吸引进去后仍不知道这里干什么。

**星系详情 `/galaxies/:slug` —— 全站身份头最重的页面**

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 团队身份头（名称+认证+定位+简介+成员规模+加入/申请） | **P0** | 全宽 ~200px；主按钮 = 加入；可用品牌色/纹理与普通页区分 |
| 2 | 内容导航 tab（概览 / 内容 / 成员） | P1 | sticky |
| 3 | 概览：精选内容 + 最新内容 | **P0** | 主栏 |
| 4 | 团队介绍 / 成员预览 / 规则 | P2 | 侧栏 320px |

- 未加入态：加入按钮 + 简介 + 规则前置（帮助决策）；
- 已加入态：内容优先，加入按钮变"已加入"弱按钮；
- 反模式警告：不得退化为"普通内容流 + 小头像"，团队身份必须占据头部主视觉。

**子页**
- `/galaxies/:slug/content`：分类/排序（仅真实能力）+ 内容列表（S3）；
- `/galaxies/:slug/members`：角色分组 + 成员网格；
- `/me/galaxies`：已加入列表 + 身份标识 + 探索入口（S3）。

#### 实施记录（三处结构改动 + 一处规划修正）

**① 搜索移出 `PageHero.actions`，成为独立的一行 P1。**
它原本挂在横幅内部，和标题、描述共用一张卡，于是「过滤整个列表」这个动作读起来像横幅的附属说明。移出后它有了自己的宽度，也恢复了横幅的完整内边距。**位置在「我的星系」之上是有意的**：搜索时「我的星系」整块隐藏，搜索框若在其下方就会随之上移一格；放在上方则原地不动。

**② 「我的星系」由网格卡片改成横向 chips（`MineStrip`）。**
它原来是第二个 `GalaxyGrid`——和「探索星系」同样的卡片、同样的大小，于是页面顶部出现两个看起来像一份列表被切成两半的网格。chips 说的是它真正不同的事：这些是回到你已属于的地方的快捷方式，不是供浏览的列表。这也让「探索星系」恢复它作为页面 P0 的地位。

**③ 教学区由「标题 + lede + 三张卡 + 尾注」压成两行文本。**
它现在是页脚的一段说明，不再是和星系网格争夺视线的第四个区块。`GALAXY_STEPS` 的 `index` 字段随之删除——01/02/03 的数字存在是为了把三张卡撑在同一行，没有卡片就不需要它们；`<ol>` 与步骤间的箭头自己承载顺序。

**④ 卡片信息结构已按规划落地（`GalaxyTile`），但「内容数」被删除。**
四处与规划文本的差异，均有理由：
- **认证从 meta 行文本改成名称旁的徽章**。旧写法把「是不是官方」和「有多少人」压成同一行同级文本，读者要读完才知道哪个是身份、哪个是数字。社区身份是默认态，标注它是冗余，故徽章只在官方时出现；
- **「成员数 · 内容数」收窄为「成员数」**。列表端点填充 `description`，但**不填充 `contentCount`**（`GalaxyView` 字段三区分），渲染它只能是一句编造；
- **「缺失时提示完善」改为「缺失时整行不渲染」**。「去完善简介」是编辑者的视角，读者视角里它只是一块噪声；留空白则会让网格里每张卡的高度错开。`description` 由 V051 列提供，admin 未填时为 null；
- **出口统一为每张卡都有「查看星系 →」**，不再是「仅 featured 有文字出口 + 其余只有尾随箭头」。尾随箭头随之移除：同一张卡里两个箭头指向同一处，是噪音。

### 3.5 系列 / 文章 —— 结构化阅读（S5 + S4 变体）✅ 批次 05 已落地（2026-10-13）

**系列广场 `/series`**（S3）

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 页头 + 筛选 | P1 | 一行 |
| 2 | 系列卡片网格 | **P0** | 卡片 = 标题 + 简介 + 章节数；简介承载"题材与阅读价值" |
| 3 | 作者 / 更新信息 | P2 | 卡片内小字 |

**系列详情 `/series/:seriesId`**（S4 变体）

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 系列头 | P1 | 标题 + 简介 + 订阅 + 开始阅读（主按钮） |
| 2 | **章节目录** | **P0** | 主栏；序号 + 标题 + 阅读状态；这是页面核心 |
| 3 | 作者与更新信息 | P2 | 侧栏或下方 |

原则：核心是目录，不是封面。

**系列阅读 `/series/:seriesId/read`**（S5 变体）

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 左侧章节导航 | P1 | 窄（~220px）、低对比、sticky、可折叠——服务正文，不与正文争注意力 |
| 2 | 当前章节正文 | **P0** | 中央 680~720px |
| 3 | 章节切换（上/下一章） | P1 | 正文头尾各一处 |
| 4 | 阅读进度 | P1 | 顶部细进度条 |
| 5 | 系列信息 | P2 | 侧栏或正文尾 |

**文章详情 `/articles/:articleId`**（S5）

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 文章头：标题 + 作者条（作者 · 时间 · 系列上下文） | P1 | 标题为页面最大字级；作者条紧凑一行 |
| 2 | 正文 | **P0** | 中央 680~720px，行高 1.75+ |
| 3 | 目录 | P1 | 右侧 240px sticky；<1024px 折叠为浮层按钮 |
| 4 | 互动（点赞 / 收藏 / 评论入口） | P2 | 正文尾或悬浮 |
| 5 | 评论 | P2 | 正文下方 |
| 6 | 相关推荐 | P2/P3 | 页尾 |
| — | 封面 | P3 | 技术文章不强制 16:9 大封面；改为列表缩略图或正文内小图 |

**收藏夹 `/collections/:id`**（S3）：收藏夹主题头（轻）+ 内容列表 + 作者信息（P2）。

#### 实施记录（一次缺陷修复 + 五条深度发现）

**① 系列阅读器的字号控件原本是坏的（本批最重的修复）。**
`.article-body` 自己声明 `text-[15px]`，**声明在元素本身，压过从 wrapper 继承的 `font-size`**；而 `ch` 相对「元素自身」字号解析——所以 A-/A+ 的唯一效果是让行宽变宽变窄，**字形始终 15px**。一个叫「字号」的控件改变了除字号以外的一切。修法两条一起才成立：
- `.article-body` 内部全部尺寸改为相对单位（`h2 1.3333em` / `h3 1.0667em` / `h4 1em` / `code·table 0.8667em`，行高按自身比例）。理由不只是「能缩放」：标题原本是 `text-xl` 等绝对值，正文一旦放大就会**反超自己的 h2，文档大纲倒置**。实测在默认 15px 正文下与原值逐像素相同；
- 新增 `.reader-column .article-body { font-size: inherit }`，让「阅读器拥有正文级尺度」成为一条显式规则；`.article-body` 的 15px 继续做文章页等其他调用方的默认值。

**② 字号与 measure 必须待在同一个元素上。**
`ch` 只认元素自身字号，把尺寸挪到子元素会让行宽悄悄不再跟随。测试锁的就是这条接线（jsdom 不加载样式表，只能锁接线）。

**③ 度量由 px 换 `ch`：`680/820/960` → `58/68/80ch`。**
- px 行宽与 px 字号不成比例：18px/680px 每行约 38 个汉字，提到 24px 降到约 28，降到 15px 升到约 45——字号控件在悄悄改变每行字数，而**行宽控件存在的唯一目的就是让字数恒定**；`ch` 随字号缩放，58/68/80ch 在每一档字号下都稳定在约 29/34/40 字；
- **`960` 物理不可达**：1200 shell − 256 侧栏 − 24 gap = 920px，「宽」这个标签承诺了布局交付不了的东西。一个标签承诺布局做不到的事，比没有这个控件更糟。24px 字号下 80ch 会超出 920px 并被它封顶——列宽是硬上限，设置是上限内的偏好；
- 默认 `68ch` 与文章页（`max-w-[68ch]`）同度量，这才是文件头一直声称的「一章读起来与文章一致」。

**④ 默认字号 18px，不是 15px。**
文章页 15px 是「社区页 + 侧栏争同一 shell」的产物；系列阅读器是专用连续阅读面，舒适优先。下限仍设 15px——那是读者可以退回的文章页字号。文件头 docblock 已同步改写，不再声称「与文章页逐字相同」。

**⑤ 侧栏 `self-start` 是承重的。**
`lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto`——flex 行默认把子项拉伸到最高项，满高 `<aside>` 在自己盒子里零行程，sticky 会**静默失效**；内层独立滚动解决「40 章列表高于视口，sticky 盒也粘不住」。另：侧栏选中态与 hover 必须不同表面（原本都是 `bg-muted`，一色两义，鼠标扫过时每一行都长得像当前章）——现选中 = 实底 + 金色左条 + `font-medium` + `aria-current`，hover = 半强度底色。

**⑥ 自我纠错：系列详情的目录行不改链到阅读器。**
曾判断目录行应改链 `/series/:id/read`，**推翻**——该路由只接受 `seriesId`，架构上无法寻址到某一章，改链过去会丢掉「读这一章」的能力；连续阅读路径已由升级为按钮的「开始阅读」承担。目录仍链 `/articles/:articleId`。

**文章详情页（§四 判定「方向正确」，属精修非重做）三处收窄**
- 封面从 675px 全宽横幅收进 68ch 阅栏（≈340px 高）并与正文共左边缘；
- 文末三块从 1200px 收进 68ch——原来评论一行跑约 85 个汉字，是舒适度量的两倍以上；
- 评论由「每条一个卡片」改为发丝分隔的一列表单。

**顺带修掉一个真实缺陷**：`ArticleInteractions.toggleLike` 的反算回滚在「先点击 → GET 后落地 → 请求失败」这条交错上会从服务端计数再减 1，显示从未存在的数字。改为**快照恢复**。

### 3.6 创作中心 —— 生产工作台（S7）✅ 批次 06 已落地（2026-10-13）

**总原则**：像工作台，不像社区宣传页；效率 > 装饰。

**`/studio` 主页 —— 从"功能卡片矩阵"改为"任务驱动"**

| 序 | 板块 | 优先级 | 呈现方式 |
|---|---|---|---|
| 1 | 继续创作（最近草稿） | **P0** | 大卡：标题 + 更新时间 + 继续按钮 |
| 2 | 新建文章 | **P0** | 主按钮，与继续创作同区 |
| 3 | 待处理事项（审核反馈 / 邀请） | P1 | 紧凑列表，可执行操作内联 |
| 4 | 数据概览 | P2 | 一行数字条 |
| 5 | 功能入口（系列 / 分类 / 协作 / 数据） | P2/P3 | 列表行或小按钮组，不再卡片矩阵 |

**`/studio/content`**：工具栏（搜索 + 筛选 + 新建）→ 列表/表格（标题 + 状态 + 更新时间 + 操作）；数据统计 P2。
**`/studio/submissions`、`/studio/submissions/:id`**：S9 状态优先——当前审核状态 + 意见（P0）→ 可执行操作（P1）→ 历史（P2）。

**编辑器 `/studio/content/:articleId` —— 独立全宽布局（脱离 1200px shell）**

```
[ 顶栏：返回 · 标题输入 · 已保存状态 · 预览 · 提交 ]   ← P1 操作常驻
[ 大纲 200px ] [ 正文（最大）          ] [ 发布设置 280px ]
```

- 大纲：帮助定位，可折叠；
- 发布设置：封面 / 话题 / 可见性——辅助创作；
- 正文是唯一 P0：两侧栏固定宽度且可收起，窄屏变抽屉；
- 有效编辑面积优先：编辑器页面不套 `.content-shell`。

**`/studio/series`、`/studio/categories`**：列表 + 编排操作（S7）。
**`/studio/collaboration`**：邀请对象 + 邀请操作（P0）→ 权限说明（P1）。
**`/studio/collaboration/accept`**：**能力边界提示**——"接受邀请不代表获得协作权限"必须作为 P1 卡片明示，不能只放角落。

#### 实施记录（S7 工作台 + S4 身份头）

**① `/studio` 主页从「功能卡片矩阵」改为任务驱动。**
它原本是欢迎横幅 + 六张等重卡片，两个问题：工作台是打开来**做事**的，最常见的意图是「写点什么」和「回到刚才在写的」，两者却在和一年用几次的数据分析、邀请链接卡片竞争；六张等重卡片是菜单不是答案，把「这六个里我要哪个」的决定推给读者，每次访问都推一次。现在按读者来做什么排序：**P0 继续创作 + 写新文章（同区并排）→ P1 待处理（紧凑行，只在有事时出现）→ P2 数据概览（一行数字，不是六张统计卡）→ P3 功能入口刻意缺席**（见下）。

**② 六个目的地刻意不在此页渲染。**
它们留在 `StudioNav`——`WorkbenchShell` 在每个 `/studio` 路由都会渲染它。两份副本会产生相同的 accessible name，屏幕阅读器会读到重复链接、role 查询会二义。规划表第 5 行「功能入口」因此以「已在 shell 中存在」的方式达成，而不是复制一份。

**③ 三源独立降级，失败要说出来。**
`getMyHome` / `listMine` / `meInsights` 并行发射、各自持有状态——失败的投稿列表不能清空草稿卡，失败的 insights 不能清空前两者。「加载中」不渲染任何东西（瞬态，announce 会让页面闪）；「失败」渲染一句指名道姓的话。把两者合并会让「你没有内容」和「我们没能查出来」长得一模一样，那正是分析页被重写要修掉的 Legacy 缺陷。

**④ `/studio/content` 补上工具栏缺失的一半：搜索。**
方案写「工具栏（搜索 + 筛选 + 新建）」，此前只有后两者。搜索**限定在当前 tab 内**按标题过滤，不跨 tab——跨 tab 搜索会与「回收站」tab 的语义矛盾。

**⑤ 编辑器路径的 `<main>` 去掉 `content-shell`（方案 §一 那句「唯一例外」的落地）。**
`.content-shell` 把页面限在 1200px 并四边留白；编辑器要的是整个视口。判定是路由级正则 `/^\/studio\/content\/[^/]+$/`，落在 `AppLayout` 上。

**⑥ 个人主页 `/u/:username`（S4）：全宽身份头 → 主栏 / 侧栏。**
栅格 `lg:grid-cols-[minmax(0,1fr)_300px]`，侧栏下移规则同 §五。身份头保持全宽（S4 的要求），作品流占主栏。

**⑦ §4.3 的「作品流 tab（文章 / 系列 / 动态）」被推翻。**
用户维度端点只有 `/{username}`、`/{username}/works`、`/{username}/works/categories`、follow/unfollow、followers/following（`CommunityUserController` 逐条核对）——**没有 `/{username}/series`，也没有 `/{username}/moments`，三个 tab 里两个没有数据源**。画出来是两条死链，只留一个 tab 则是纯噪声。改由真实存在的第二维（创作空间分类，`?category=<slug>` + 响应里的 `categories`）承担筛选。三个实现细节：`categories` 为空时整条不渲染（没有分类的空间不该看到一个只有「全部」的筛选条）；用 `aria-pressed` 而非 `aria-current`（这些是开关，不是页面导航）；选中的 chip 再点一次直接 return。

**⑧ 筛选状态是本地 state 而非 URL——由此产生一次「虚假地址」处置。**
筛选存成 `{username, slug}` 一对而不是裸 slug：路由从 `/u/A` 换到 `/u/B` 时 React 不会重挂本组件，裸 slug 会被带进 B 的页面；用 effect 重置不行（effect 在本次提交里跑，而 works 的请求 effect 读的是「本次渲染」的 slug，等重置生效时请求已带着 A 的分类发出去了）。渲染期比对用户名则让 B 的第一帧直接拿到 `null`。
本批据此**删除了 `categoryPathHint`**：它曾为创建表单构造 `/u/{handle}/works/{slug}` 预览行，但该路由从来不存在（`routes.tsx` 全文只有一条 `/u` 路由，即 `/u/:username`；归档代码里也没有）。分类只有 name 和 slug，**没有页面**——slug 是后端查询参数（`GET /users/{handle}/works?category=`），筛选是本地 state。函数与那条钉住虚构路径的测试一并删除（留着比没有测试更坏：它会让后来人以为该路由存在），预览行改为描述 slug 的用途。

---

## 四、其余页面组的布局模式

### 4.1 搜索与广场类

- **搜索 `/search`**（S3 变体）：sticky 搜索框（P1）→ 结果类型 tab（P1）→ 结果列表（**P0**，密度高于 feed）→ 数量与相关推荐（P2）；
- **创作者广场 `/creators`**（S3）：用户卡片网格（头像 + 名字 + 简介 + 关注按钮）；作品方向（P2）用标签行呈现。

### 4.2 动态与活动

- **动态广场 `/moments`**：发布框（P1，紧凑）+ 动态流（**P0**，低密度卡片——比文章卡片轻，无摘要大图）；辅助发现（P2）；
- **动态详情 `/moments/:id`**：原动态（**P0**）+ 评论与互动（P2）+ 作者上下文（P2）；
- **活动列表 `/events`**：**状态分组**——进行中（**P0**）→ 即将开始（P2）→ 已结束（P3，去饱和）；
  - **状态徽标视觉优先于封面**：已结束的活动不允许先看到漂亮封面和报名按钮，必须一眼知道它结束了；
- **活动详情 `/events/:eventId`**：主题 + 时间 + 规则（**P0**）→ 报名/投稿（P1）→ 相关内容（P2）；
- **投稿 `/events/:eventId/submit`**（S8/S9）：提交内容 + 资格确认（**P0**）→ 规则（P1）→ 反馈（P1）；
- **`/me/events`、`/me/moments`**：页头 + 列表（S7 轻量）；状态与操作优先。

#### 实施记录（批次 07：四域表面 / 字号 / 动效三类规则 + 四处结构改动）

**① 表面统一：moments / events / messages / notifications 四域。**

域卡片一律 `rounded-xl border border-border/70 bg-card`。**events 域的 `rounded-lg` 是本域旧语言、已全量清除**——它不是"略小一点的圆角"，而是一套与全站不同源的表面规格，同一应用里两种圆角并存时，读者读到的是两个团队各写了一半。`bg-card/70`、`border-border/60` 一类弱化档只保留在三处刻意位置（`DiscoverFocusItem` 的紧凑档、`TopicsPage` 空态等，均属 01–06 范围）。

**② 字号归位：`text-xs` / `text-[10px]` 两档在本批被域级替换。**

events 域是全库最密集的漂移点——**29 处 `text-xs` + 13 处 `text-[10px]`**，两者都不是 `tokens.css` 声明的档位（display 28 / title 18 / card 15 / meta 13）。统一改 `text-meta`，**唯一例外是状态 chip 保留 11px**：chip 是徽标不是散文，13px 塞进 2px padding 的药丸里会读成一团墨块。messages 域确立三档分工并写入文件头——**散文 `text-meta`（13px）／微标签 `text-[11px]`／控件 `text-sm`；全域不再有任何 10px 文本**。11px 是全库下限（`.eyebrow` 用的就是它）。

**③ 动效接入六域，但"错峰"与"replay"各有一道判据。**

- **错峰只给「长度由服务端决定」的列表**。`GuideIndexPage` 刻意不错峰：入口是 `GUIDE_ENTRIES` 里写死的两条，长度在渲染前就已知，错峰没有信息可传达；`ModerationDetailPage` / `AppealDetailPage` 同样不做——在长度固定的区块栈上再叠一层入场，只会让页面更慢读完。错峰延时**必须走 inline style**（`animate-rise-in` 是 `animation` shorthand，会重置 `animation-delay`）。
- **入场每题只播一次，是否 replay 看"切换是不是读者自己的动作"**。`MailboxPage` 逐字写明不 replay 的理由：socket 每收到一条消息就推一帧，因为有人说了一句话就把整个收件箱重播一遍，正是本批要避免的动效滥用。而**在固定 tab 集合之间切换的页面要 replay**（`MyEventsPage` 用 `key={tab}`）——那里的切换是读者自己的动作，动效回应的是他刚做的事。
- **按天分组时错峰按组重起算**（`NotificationsPage`）：一天是一个独立的视觉单元。

**④ `MomentsPage` 删掉发布框的面板头。**

它原本是 40px 的 chrome，命名着一个读者用不上的内部术语，还让发布器读起来像整页最重的表面——而本页的 P0 是它下面的动态流。label 保留 `sr-only`，`getByLabelText("动态正文")` 的查询契约因此不动。

**⑤ `MomentDetailPage` 新增共享互动条与评论线程（`objectType="MOMENT"`）。**

复用文章详情的互动组件，而不是为动态写第二份。**该卡刻意不加 `card-lift`**——`.card-lift` 只给"整张卡本身是链接"的元素；这张卡里只有标题和几个按钮是链接，抬起它等于承诺一个点击不会兑现的可点性。

**⑥ `EventsPage` 页头由裸 `<h1>` 换成 `PageHero`。**

`/events` 是第五个广场型表面，前四个（`/moments`、`/galaxies`、`/series`、`/creators`）已经都用 `PageHero` 开场；`PageHeader.tsx` 自己画的分界线是「广场页 SELLS the page，工具页只 LABELS it 然后让开」。**`PageMasthead` 不是替代选项**——它自己的文档写着广场页 "still use the banner, and should"。插画走共享的 `hero` 槽位而非另画一张：按页定制的占位图最终都会被同一张共享图替换，那它就只可能变成一次分叉。

**⑦ `MyEventsPage` 收敛为单一表面 + `key={tab}` 重播。**

状态与操作优先（方案原文）——分组切换时不该出现"两张卡上下叠着"，那是两套容器在讲一件事。

**⑧ messages 的列表形状是**独立卡片 + `flex flex-col gap-2`**，全库唯一一处。**

其余列表都是"单卡 + `divide-y`"。收件箱不能用分隔线：一行自带未读状态、自带 hover，分隔线两样都表达不了。**这是形状，不是疏忽**——文件头已把这条写死，避免后来人"顺手统一"。

**⑨ `NotificationToaster` 的布局契约改为**桌面右下角 420px 向上堆叠 / 移动端顶栏下全宽向下堆叠**。**

手机视口底部归浏览器 chrome 和拇指，锚在底部的 toast 会同时被两者压住；桌面两条都不成立，而右下角是 1200px shell 里最少被争用的区域。移动端同时抑制缩放：全宽卡片缩 2% 读不出深度，只读得出"这张卡没对齐边距"。

**⑩ 新增 `NEUTRAL_DISC`（toast 类型色）。**

`tokens.css` 要求每个组件颜色都经语义变量解析，而本设计系统**没有 info / success / warning 家族**——没有 token 可迁。且后端今天只产出一个类别（`notifyUserFollowed` → FOLLOW）。为四个永远不会到达的类别发明一套经过校验的调色板，等于造四种没人见过的颜色。

**⑪ 例外登记：`/me/moments` 的页头不是权威 S7 形态。**

`MyMomentsPage.tsx:164` 用 `<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">`——无发丝线、无 `.lede`，而是「标题 + ID 行 + bio 行 + 一个操作」的四行 flex 页头。**这是有书面论证的既有形态，不是漏做**：本页与 `/moments` 同族，而后者本来就不带表面，两页应当读成一个家族而不是两个。`sm:items-end` 而非 `sm:items-center` 也是刻意的——把按钮居中在一个三行文本块旁边，它就读成卡片的尾部控件；底对齐把它放回文本最后一条基线上，那才像页头的一行。

### 4.3 个人主页与我的内容

- **个人主页 `/u/:username`**（S4）：身份头（头像 + 昵称 + 简介 + 关注按钮）→ 作品流 tab（文章 / 系列 / 动态）→ 社交统计（P2）；
  - 是给别人看的：优先身份、作品与"值得关注的理由"；
- **我的内容组 `/me/*`**（S7 轻量：页头 + 列表）：
  - 总原则：优先状态、记录和操作，**不放个人资料大卡**（与个人主页区分）；
  - `/me/collections`：新建 + 管理优先；
  - `/me/bookshelf`：继续阅读优先（进度条）；
  - `/me/requests`：可执行操作内联在卡片上（同意/拒绝）；
  - `/me/badges`：已获得（彩色）→ 未获得（灰）+ 规则说明（P2）；
  - `/me/interests`：chips 可编辑；
  - `/me/following`、`/me/followers`、`/me/likes`、`/me/comments`：列表 + 跳转原内容/主页。
  - `/me` 本身是重定向入口，不设计独立主页。

#### 实施记录（批次 08a：记录组六域 14 文件 / +231 −224）

**① 页头去卡：六域 9 处卡片式页头改为发丝线页头。**

被替换的形态是 `<header className="rounded-lg border border-border bg-card p-5">`——**它把页头做成了一个内容面板**。记录组的页头只陈述"这是哪一页"，它下方的 section 才是记录；给陈述一个边框平面，就是在本已自带表面的内容之上再压一层白板。新形态（12 处落地，其中 3 处原为其他形态）：

```tsx
<header className="border-b border-border/70 pb-5">
  <h1 className="text-2xl font-semibold tracking-tight text-primary">标题</h1>
  <p className="lede mt-2 max-w-2xl">说明行</p>
</header>
```

**该形态在全库的落地处数从批次 08 开始时的 8 处涨到 27 处**（26 个页面级 JSX + 共享 `PageHeader.tsx` 自身定义）。这不是"发明了一种新页头"，而是**一条已被 8 处使用的形态，本批把它变成了记录 / 治理 / 工具页的统一页头语言**。

**② 说明行统一走 `.lede mt-2 max-w-2xl`。**

原为 `<p className="mt-2 max-w-xl text-sm text-muted-foreground">`——13px 与 15px 混用、`max-w-xl`（576px）与 `max-w-2xl`（672px）混用。`.lede` 自己不带宽度（`text-meta leading-6 text-muted-foreground`），宽度由调用方给，所以 `max-w-2xl` 是显式的选择而非默认值。

**③ 表面升档：32 处 `rounded-lg border border-border` → 25 处 `rounded-xl border border-border/70`。**

`rounded-lg` + 全量描边是记录组的旧表面语言。升档后与全站一致，并由此固化**三级边框惯例**：

| 层级 | 取值 | 用在哪 |
|---|---|---|
| 布局 chrome | `border-border/70` | 卡片外框、页头发丝线 |
| 内容区分隔 | `border-border`（全量） | 列表行分隔线 |
| 卡内 / 次级 | `border-border/60` | 卡内小分隔、紧凑档表面 |

判据逐字（`MyReportsPage` 注释）：**「外框 70% 配内部分隔全量，列表就该长这样，行才是结构，框只是边界」**——外框比内部分隔更弱，读者的眼睛才会先看到行、后看到框。

**④ `text-accent` 残留补扫 29 处 → `text-accent-strong`。**

批次 06 的红线扫除记录是「109 处 `text-accent` → `text-accent-strong`」，但六域仍有一批文本链接停在纯金上。**纯金在 cream 底上 2.01:1，不达 AA**，文本一律走 `--accent-strong`。补扫覆盖 `text-accent` 与 `hover:text-accent` 两种写法。

> **已知残留（7 处，不在本批范围）**：`GalaxyVisual.tsx`（`text-accent/90`）、`GalaxyDetailPage.tsx`（`text-accent/80`）、`HomeFeedItem.tsx`（两处 `fill-current text-accent`，点赞与收藏的**状态指示器**）、`HomeNotice.tsx`、`ExplorationInterestsPage.tsx`、`OnboardingPage.tsx`（三处 lucide 装饰图标）。前四处是**有语义的图形**（非文本），适用 WCAG 1.4.11 的 3:1，纯金同样不达；后三处是纯装饰（旁边有文本承载语义），不受约束。

> **处置结论（后续批次补记）：7 处全部保留纯金，不换 token；判据已 7/7 落盘。** 判定不成立的两个前提被逐一排除：① 这 7 处**都不是文本**，`--accent-strong` 的适用域是「文本」，把它们换掉不是修正对比度而是给装饰件降饱和；② 其中 2 处带透明度修饰符（`/90`、`/80`），换 token 会同时改掉视觉强度——那属于**改设计**，不属于补扫。两处状态指示器（点赞 Heart / 收藏 Bookmark）另有独立理由：它们**已用 `fill-current` 的填充与旁边的计数/标签双重编码状态**（`aria-pressed` 也在），颜色从来不是唯一载体，因此不受 1.4.11 约束——`HomeFeedItem` 的注释把这条写成了**「语义分色」**：同一次交互里，图形保留纯金、文本走 `--accent-strong`。这正是 03.0 基础设施里 `--accent` 与 `--accent-strong` 双 token 并存的**设计意图**，不是残留。

**⑤ 整卡链接迁 `card-lift`（2 处）。**

`CollectionPublicPage` 的整卡链接从 `transition-colors hover:border-accent-line` 迁到 `card-lift`，`MyGroupsPage` 的同类卡片同样接入。**迁移时 `hover:border-accent-line` 被显式删除**，理由已写进代码：

> `.card-lift` already transitions `border-color` and the two rules would race on the same property.

即 `.card-lift` 自带 `border-color` 过渡，再叠一条 `hover:border-accent-line` 会有两条 `border-color` 规则在同一属性上竞争。**但这不是"技术失效"，是"语义冲突"**——`.card-lift` 的文档写明「描边从 /70 收到全量，换的是锐度不是色相」，再叠金色是**换色相**，与它自己的设计意图相反。

> **存量不一致（2 处）**：`StudioPage.tsx:170` 与 `TopicCard.tsx:57` 同时使用 `card-lift` 与 `hover:border-accent-line`（属批次 03–06 产物，那时这条判据尚未写下来）。技术上 utilities 层胜出、金色生效，所以**不是 bug**；但两处与批次 08 起的新判据不一致，待后续统一。

> **处置结论（后续批次补记）：两处不同解——一处保留、一处删除。判据是「静止态是否已经是金色」。**
>
> **先补一条实证。** 此前文档只写到「技术上 utilities 层胜出」，那是**推断**，从未验证。用构建产物做了确定性核验：
>
> ```
> dist/assets/index-*.css:
>   offset  6435  → .card-lift{transition-property:...}
>   offset  6617  → .card-lift:hover{--tw-translate-y:-.125rem;...}
>   offset 46953  → .hover\:border-accent-line:hover{border-color:hsl(var(--accent-line))}
> ```
>
> component 层（6617）**确实排在** utilities 层（46953）之前 ⇒ `hover:border-accent-line` 胜出，金色生效。原文里「两条规则会在同一属性上竞争（race）」的措辞**不准确**：真实机制是**层叠顺序**，两条规则从不竞争，后者单纯覆盖前者。这个区别有实际后果——如果机制真是竞态，行为会随构建顺序漂移；因为是层叠，它是**确定的**。
>
> **`StudioPage.tsx:170`：保留两者，`card-lift` 是「修正」而非「冲突」。** 该卡静止态本身就是金色（`border-accent-line/50 bg-accent-soft/40`），而 `.card-lift:hover` 的 `border-color:var(--border)` 会把它**从金色拉回灰色**。`hover:border-accent-line` 在这里做的是**把颜色改回金色**，即修正 `card-lift` 的错误 hover。若按「迁移时必删 `hover:border-accent-line`」的规则一刀切，卡片悬停会变灰——那是退化，不是统一。**§4.3 ⑤ 的迁移规则因此加一条限定：只适用于静止态不是金色的卡。** 判据已写进代码注释。
>
> **`TopicCard.tsx:57`：`card-lift` 确实是「谎」，删除。** 该卡因关注按钮必须降级为 `<article>`（交互元素不可嵌套），整卡不再是可点目标，违反 `globals.css` 的「a card that merely contains a link must not lift… **the lift is a lie the click then corrects**」。终值 `rounded-xl border border-border/70 bg-card p-4`——与三处已定案先例（`FollowUserRow` / `EventCard` / `BookshelfPage`）一致。**连带修复**：容器上的 `group` 下移到「图标 + 名称」那一行，因为 `TopicVisual` 的 `group-hover` 升温依赖它，直接删掉会**静默丢失一处动效**；而名称是该卡唯一的可点目标，`group` 挂在那一行才是诚实的。
>
> **`GalaxyTile` 的 `mine` variant 证明这不是孤例，而是一种有理由的形态**：它同样带 `card-lift` + `hover:border-accent-line`（金色静止态 + hover 修正），与 `StudioPage` 同类。
>
> **方法论留痕**：① 层叠关系必须**实测**（构建产物字节偏移）而不是推断，措辞的准确性会影响后续判断；② **同类冲突不一定同解**——判别依据是「静止态是否已是金色」，不是「出现了同一个类名组合」；③ **删 `group` 之前必须 grep `group-hover`**，否则会静默丢失下游动效。

**⑤b 整卡链接补 `card-lift`（4 处候选：迁 2 / 留 2）。**

批次 08 的核查在反向方向上也留了一份候选清单——**已经是整卡 `<Link>`、但还没接 `card-lift`**。四处逐一读完上下文后**两迁两留**，理由是「抬升是不是真话」在四处各不相同：

| 处 | 判定 | 依据 |
|---|---|---|
| `GalaxyMembersPage` 成员行 | **迁** | 整卡 `<Link>`，网格里唯一的键盘停靠点 ⇒ `card-lift focus-ring`，顺带删 `hover:border-accent`（`.card-lift` 自带 hover，且它的动作是**收锐度不换色相**）与 `rounded-lg` 旧表面 |
| `MyGalaxiesPage` 星系卡 | **迁** | 同上，`card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4` |
| `ConversationRow` 会话行 | **留** | ① 它用的是**状态驱动表面**（`active ? border-accent bg-accent/10 : border-border/70 bg-card hover:bg-muted`），`.card-lift` 的 `:hover{border-color}` 会与 `active` 的金边打架；② 邮件列表行的命中目标是**行**（`p-3` 紧凑态），`-translate-y-0.5` 在密集列表里会让相邻行错位 |
| `CommunityEventsPanel` 首页 rail 行 | **留** | 首页右栏的紧凑行（`p-2.5`），坐在 `bg-surface-sunken/55` 上，**表面语言由 rail 决定**（与 `AnnouncementPanel` / `RecommendedCreatorsPanel` 同族）；且它无固定高度，抬升在紧凑行里过重 |

两条迁移的终值与先例完全一致：`card-lift focus-ring … rounded-xl border border-border/70 bg-card p-4`（`GuideIndexPage` / `AnnouncementsPage` / `MyGroupsPage` / `MomentsPage` / `GalaxyTile`）。**`focus-ring` 不是装饰**：这两处卡片是各自网格里唯一的键盘可达元素，而没有任何全局样式会给 `<Link>` 加环。

> **方法论留痕**：`card-lift` 的判据只有一条——**「抬升说的是不是真话」**——但落到具体一行要看三件事：整卡是不是真链接、hover 语言会不会与状态色打架、**抬升在紧凑密度里是否过重**。第三条在文档里此前没写过：`.card-lift` 的 `-translate-y-0.5`（2px）在 `p-4` 的卡上是对的，在 `p-2.5` 的 rail 行上会让整条栏看起来在抖。

**⑤c 顺带修复**：`MyGalaxiesPage` 空态区的两个文本链仍停在 `text-accent`（非 strong），随 ⑤b 的编辑一并改到 `text-accent-strong`——同一文件同一次编辑，不另立批次。

**⑥ 手写控件补焦点环（2 处）。**

两处 `w-full rounded-md border border-input bg-background px-3 py-2 text-sm` 的手写 input 补 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`。**刻意不换成 `ui/` 表单组件**——那是最小干预原则：加环只改一件事，换组件会顺带改掉 border 色、bg、尺寸三样视觉。

**⑦ `CollectionsPage` 用共享 `PageHeader` 的 `actions` 槽，而不是手写 flex 行。**

代码注释逐字：「the primary control belongs to the page's identity line」。这与记录组其余页面的"手写发丝线页头"**不矛盾**：`PageHeader` 自身就是同一条发丝线（`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border/70 pb-5`），区别只在它多一个右侧操作槽。

**⑧ `RecommendationFeedbackPage` 清掉一个死变量 `submitFailed`。**

该 state 声明后写入 4 次，**唯一读取处是两个"两侧逐字相同"的三元表达式**：

```tsx
role={submitFailed ? "alert" : "alert"}
className={cn("mt-2 text-sm", submitFailed ? "text-destructive" : "text-destructive")}
```

⇒ 它从不改变任何输出。**写出但从不产生分支差异的 state 不是"为将来预留"，是一层会误导下一个读者的假分支**。清理为常量 + 判据注释（校验错误与被拒提交在本页刻意读起来一样）。

**⑨ 设置域复核结论：零改动。**

`git diff -- xingyu-web/src/features/settings` 返回 **0 行**，文件 mtime 停在 10-03 / 10-08 ⇒ 一度怀疑漏做。用 `git blame` 追到 `SettingsLayout.tsx:24` 的发丝线页头来自 `1e6c72ab`（2026-10-03，批次 08 之前），且全部表面已是 `rounded-xl border border-border/70` ⇒ **结论：设置域属"复核确认已达标、无需改动"，不是漏做**。

> **方法论留痕**：`git diff` 为空的域可能是「本来达标」而非「漏做」，必须用 `git blame` 区分二者。只凭 diff 为空就判定"漏做"，会让人去重做一份已经正确的实现。

### 4.4 私信与通知

- **私信 `/messages`**（S6）：320px 会话列表 + 聊天区；
  - **P0**：聊天记录 + 输入框；
  - **P1**：对方身份（聊天区顶部条）、附件入口；
  - **P2**：搜索、群聊资料、文件列表、创建会话——**收进面板 / 抽屉，不占第一视觉中心**；
  - 移动端：列表 / 聊天两态切换，优先保证消息区与输入框空间；
- **`/messages/search`、`/media`、`/files`**：以"定位原消息"为核心（P0 = 搜索结果 / 媒体 / 文件，P1 = 上下文与定位）；
- **`/messages/saved` 能力边界**：此前缺少"收藏某条私信"的交互入口——布局不假设功能闭环；入口补齐前，该页可先不露出；
- **通知 `/notifications`**：未读与需处理（**P0**，分组置顶）→ 历史（P2，去饱和）→ 类型 icon 辅助扫读。

### 4.5 设置与认证

- **设置 `/settings/*`**（S7）：左导航（分类）+ 表单区（沿用现有 SettingsLayout 栅格 `[200px_minmax(0,1fr)]`）；
  - 高风险页（`delete-account`、`api-tokens`、`security/email`）：**操作后果说明紧贴操作按钮**（P1 位置，不是角落）；
  - 设置类页面简单、稳定、可预测，不追求视觉花哨；
- **引导 `/onboarding`**（S8）：步骤条（当前步骤 **P0**）+ 任务区 + 继续/跳过（P1）；
  - 旧路径 `welcome / interests / follows / profile` 只是别名入口，统一一套布局；
- **认证页组**（S8）：
  - 登录（窄栏 `max-w-md`）：表单（**P0**）→ 找回密码 / 注册（P1）→ 品牌说明（P3）；
  - 注册（宽栏 `max-w-4xl`）：表单 + 社区价值介绍（左表单右说明的双栏）；
  - `verify-email`、`forgot/reset-password`、`force-change-password`、`register/pending-audit`：窄栏 + 结果/表单；
  - 现有 `AuthLayout` narrow/wide 两档已支持，保留。

#### 实施记录（批次 08a–08b：设置复核 + 认证域 L1 + 引导页三处缺陷）

**① 设置域：复核确认已达标，零改动。**（详见 §4.3 实施记录 ⑨，含 `git blame` 佐证与方法论留痕）

**② 认证域 L1 统一为 20px（`text-xl`）——修掉一个"点一次提交标题就长高 5px"的缺陷。**

`AuthCard` 的 h1 曾写 `text-card`，理由是「沿用卡片的标题档（= 20px / `text-xl`）、与其余认证页标题一致」。**写下时前半句是对的**；`tokens.css` 改档后 `--text-card` 变成 `0.9375rem`（15px），它现在是「卡片 / 行主文本」档——全库 44 处 `text-card` 里除本处外全是列表行标题或卡内小标题。

于是认证域同时存在两个 L1：本壳 15px，而 `AuthStatusPanel` / `ForceChangePasswordPage` / `PendingAuditPage` 都是 20px。**同一页会在状态切换时跳字号**——`ForgotPasswordPage` 的表单态走本壳、发送成功态走 `AuthStatusPanel`；`ResetPasswordPage` 的 token 失效态同理。判据逐字：

> 读者点一次提交，标题就长高 5px —— 这不是层级，是两套规格撞在一起。

**不取 `text-2xl`**：那是内容页的 L1（全库 55 处），而认证页是 S8 窄栏（`max-w-md` = 448px）。终值：认证域 5 个 h1 里 4 个是 20px，**唯一例外是 `/register` 宽栏态保留 24px**（`max-w-4xl` 双栏，左表单右说明，是 S8 的宽档而非窄档）。

**③ 说明行与页脚一并收进 `text-meta`。**

`CardDescription` 的 `text-sm` 是「卡片描述」的尺寸，而这里是**整页**的说明行，覆盖成 `text-meta leading-6`（与 `.lede` 一致）。页脚同理：认证域所有辅助文本都是 `text-meta`（`AuthStatusPanel` 正文、`authStatusLinkClass`、`authStatusPrimaryClass`、`AuthFormError`），**只有本壳页脚写 `text-sm`**，于是 `ForgotPasswordPage` 表单态的「返回登录」是 14px、提交成功后的同类链接是 13px。改 `text-meta`，与 h1 一样收进同一套规格。注册页的密码规则提示同理（原 `text-xs` 12px 紧挨着 `text-meta` 13px，**叠在一起像两级信息**）。

**④ 抽取 `AuthCaptchaImage`（新文件）。**

登录与注册各自手画这张图，**两份都从它们旁边的控件漂移了**：`h-10 rounded` 对着一个 `h-9 rounded-md` 的 `Input`——图比它所属的字段上下各悬出 2px、圆角也不同，**读成失误而不是选择，因为一个控件行只有一个高度**。

两个承重细节：
- **`shrink-0` 是承重的**——旁边的 `Input` 是 `w-full`，窄屏下 flex 行会欣然压扁验证码而不是字段。**被挤扁的验证码是没人能读的验证码。**
- **边框保持 `border-border` 而非 `border-input`**：两者在 `tokens.css` 里同值（`40 14% 87%`），区分只有语义意义，而这是一个图片框、不是控件。

**⑤ 引导页 `/onboarding`：三处缺陷修复。**

- **五张步骤卡表面升档**：`rounded-lg border border-border bg-card p-6` → `rounded-xl border border-border/70 bg-card p-6`。判据：**引导页的每一步都是一张卡**，取批次 07 起的卡片对，与全站一致。
- **五个 h2 全部收进 `.section-heading`**（18px 标准档，全库 65 处）。原本 `text-lg font-medium` 与 `text-lg font-semibold` 混用——**字号本来就没差**（`text-lg` 与 `text-title` 都是 18px），差的是字重，而只有「欢迎来到星语」是 600。同一个角色写两种字重，读者会去找那个不存在的差别。
- **tablist 从 `overflow-x-auto` 改为 `flex-wrap`**：八个兴趣域在 624px 内容宽里需要约 688px，**横向滚动会把「社区与文化」默认藏起来**——与 `SettingsNav` / `StudioNav` 修过的「隐藏导航」同类问题。
- **简介 textarea 换 `ui/Textarea`**，`saveError` 换 `AuthFormError focusOnMount`（后者按错误出现位置决定是否抢焦点：错误出现时光标落在哪，就把它带进视口）。

**⑥ 全库 `text-[10px]` 只剩 1 处真实使用**（`ArticleDetailPage.tsx:103` 的序号圆点，属批次 05 范围）。批次 07 的 events 域清掉 13 处、onboarding 的步骤序号从 10px 提到 11px 之后，**11px 事实上成为全库文本下限**（`.eyebrow` 用的就是它）。

### 4.6 公告、指南与治理

- **公告 `/announcements`**：列表（最新在前，**P0**）→ 历史（P2）；**`/announcements/:id`**：正文（S5）+ 发布信息（P1）；
- **指南 `/guide`、`/guide/:slug`**：分类入口（**P0**）→ 正文与操作步骤（S5，步骤化排版）+ 关联指南（P2）；
- **规则 `/rules`**：正文（S5）+ 章节导航（P1）；
- **治理页组 `/reports/*`、`/appeals/*`**（S9）：
  - **P0**：处理状态、进度、下一步操作；
  - P1：申诉理由 / 补充材料入口；
  - P2：时间线、历史；
  - 原则：用户来举报和申诉不是来欣赏视觉设计的——状态与操作必须比装饰优先；
  - `/reports/new`、`/appeals/new`：对象 + 原因（**P0**）→ 说明与规则链接（P1）→ 提交（P1）。

#### 实施记录（批次 08c–08d：治理六页去卡 + 公告指南的 `PageHeader` 首用）

**① 治理页组六页页头去卡、去图标。**

被替换的形态是：

```tsx
<header className="rounded-lg border border-border bg-card p-5">
  <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
    <FlagIcon /> 我的举报
  </h1>
  <p className="mt-2 max-w-xl text-sm text-muted-foreground">…</p>
</header>
```

改为 §4.3 实施记录 ① 的发丝线形态，**同时删掉 h1 里的图标**。两条全库核查支撑这个判断：

- **全库 15 处带图标的 h1，全部落在卡片式页头里，零反例**；无卡片页头的 h1（含 `NotificationsPage`、`SettingsLayout`）**全部无图标**。⇒ 图标与卡片是一起出现、一起消失的，它不是被"顺手删掉"的。
- **全库另有 15 处卡片式页头，逐一查过：零处带「刻意保留」注释**——它们是存量，不是设计。

判据逐字（方案 §4.6 原则的代码化）：**「用户来举报和申诉不是来欣赏视觉设计的——状态与操作必须比装饰优先」**。一个旗子图标与"我的举报"四个字说的是同一件事，而它占的是首屏最贵的位置。

**② 三处可用性缺陷修复（治理域）。**

- **`/reports/new`、`/appeals/new` 的说明 textarea 补 `.focus-ring`**：原本 Tab 进去看不出焦点在哪。**最小干预**——不动 border 色、不动 bg、也不换成 `ui/` 表单组件；本域没有 `ui/` 表单组件的既有语境，换组件会顺带改掉三样视觉，超出「修缺陷」的范围。
- **提交失败从裸 `<p className="text-sm text-destructive">` 换成 `AuthFormError focusOnMount`**（表单级失败，错误在表单底部，不聚焦用户看不到）。这是**跨域复用**——`AuthFormError` 的注释自己点名了 `bare <p class="text-sm text-destructive">` 这个反模式，08b 已在 onboarding 建好复用先例。
- **`ReportDetailPage` 的提交按钮改 `buttonVariants({ variant: "accent" })`**：原本是手写 class，**没有焦点环**；`buttonVariants` 自带 `focus-visible:ring-2`。与上一条的分工是**按错误出现位置决定的**——本页的错误就出现在刚点的按钮正上方，读者视线还在原地，把焦点抢走反而把人从输入框上挪开，所以**不传 `focusOnMount`**。

**③ 字号与 `text-accent` 补扫（治理 + 公告 + 指南 + 规则 + 创作者）。**

`text-xs` → `text-meta`（如「最多 N 条」「按最近更新」）；`text-accent` / `hover:text-accent` → `text-accent-strong`（含 `ReportLink`、`CreatorCardItem` 与四个 detail 页的返回链接）。

**④ `AnnouncementsPage` 成为共享 `PageHeader` 的全库第一个真正使用者。**

`PageHeader` 此前全库零调用——它的文档把自己从「所有工具页的一级原语」降级成了「可选，不是模板」。这里没有违背那次降级，**只是给了它第一个真正的使用者**：它的 class 串逐字就是批次 08 的页头形态（`border-b border-border/70 pb-5`），另外多一个 `actions` 槽，正好装右侧那个「指南 →」链接。**手写一份只会多一个需要同步的副本。**

该页同时**刻意不传 `description`**——公告列表的说明行没有信息量，一条不说明任何事的说明行只是把 P0 往下推。

**⑤ 整卡链接接入 `card-lift` + `focus-ring`（公告列表、指南索引）。**

两页的卡片原本是 `block rounded-lg border border-border bg-card p-4 hover:border-accent`——旧表面 + 旧写法。改为 `card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4`，并**刻意不叠 `hover:border-accent-line`**（判据同 §4.3 实施记录 ⑤）。`focus-ring` 是两页原先都缺的。

**⑥ 错峰：公告列表做，指南索引刻意不做。**

`AnnouncementsPage` 的列表长度由服务端决定 ⇒ 接入 `animate-rise-in` + 错峰延时。`GuideIndexPage` **刻意不错峰**——入口是 `GUIDE_ENTRIES` 里写死的两条，长度在渲染前就已知，**错峰没有信息可传达**。两页的对比本身就是这条判据的说明书。

**⑦ 全局路由入场不与页面入场叠加。**

四个 detail 页都留了同一条注释：路由切换的入场由 `AppLayout` 的 `animate-page-enter` 统一负责，页面内不再自己包一层。**两层入场叠起来不会更"顺滑"，只会让内容慢两次到达。**

---

## 五、响应式策略

沿用现有断点体系（`lg`=1024px 导航切换，`md`=768px 栅格折叠），为九套骨架定义降级规则：

| 骨架 | ≥1024px | 768~1023px | <768px |
|---|---|---|---|
| S1 内容流 | 主栏 + rail | rail 移至 feed 后 | 单列；rail 收为折叠区 |
| S2 bento | 12 列差异网格 | 大卡 8→12 列占满 | 全单列 |
| S3 广场 | 2~3 列 | 2 列 | 1 列 |
| S4 身份详情 | 身份头 + 主/侧栏 | 侧栏下移 | 单列；tab 横向滚动 |
| S5 阅读 | 正文 + 目录 rail | 目录折叠为浮层按钮 | 同左；正文全宽 |
| S6 会话 | 列表 + 聊天 | 列表 280px | 两态切换（列表 ⇄ 聊天） |
| S7 工作台 | 左导航 + 主区 | 导航收窄 | 导航变顶部横条/抽屉 |
| S8 窄栏 | 居中 | 居中 | 全宽 + 内边距 |
| S9 状态 | 状态卡 + 时间线 | 同左 | 单列 |

**编辑器特殊规则**：<1280px 时右侧发布设置收为抽屉；<1024px 时大纲也收为抽屉，正文占满。

---

## 六、改造顺序与分批落地

沿用《信息优先级.md》的八步顺序，映射到具体布局动作：

| 批次 | 页面 | 布局动作 | 涉及骨架 | 状态 |
|---|---|---|---|---|
| 01 | 首页 | 压缩 Masthead；确认首屏预算；feed 卡片层级 | S1 | ✅ 已达标（无需改动，复核见 §3.1） |
| 02 | 发现页 | 顺序调整为"说明行 → 精选 → 探索入口"；入口降级为 chips | S2 | ✅ 已落地（偏离记录见 §3.2） |
| 03 | 星系广场 + 详情 | 卡片信息结构重做；身份头强化；教学区缩短 | S3 + S4 | ✅ 已落地（偏离见 §3.4） |
| 04 | 话题广场 + 详情 | 筛选条 sticky；身份头轻量化；与星系职责分离 | S3 + S1 | ✅ 已落地（偏离见 §3.3） |
| 05 | 文章详情 + 系列阅读 | 阅读宽度 680~720px 固定；目录/章节导航行为定义 | S5 | ✅ 已落地（偏离见 §3.5） |
| 06 | 个人主页 + 创作中心 | 身份头 vs 工作台两种语言；/studio 任务驱动化 | S4 + S7 | ✅ 已落地（偏离见 §3.6） |
| 07 | 动态、活动、私信 | 动态轻密度；活动状态优先；私信双栏 | S1/S3 + S6 | ✅ 已落地（偏离见 §4.2） |
| 08 | 设置、记录、认证、治理 | 统一 S7/S8/S9 模式，细节可用性 | S7/S8/S9 | ✅ 已落地（偏离见 §4.3 / §4.5 / §4.6） |

**落地纪律**：
- 每批先定骨架（本节表格），再进视觉细节；
- 不为了让发现页"看起来丰富"而增加后端未支持的排序/推荐能力；
- 已有正确骨架的页面（首页、话题详情、文章详情）只调比例、入口位置与无效留白，不推倒重做。

### 6.2 横向工程：动效 / 插图 / 表面细化

三项横向工程与布局批次**同批落地**，但基础设施先建一次（批次 03 前完成），后续各批只做接入，不重复造轮子。

#### A. 动效体系

**四条设计约束**（先立规矩，再谈实现）：

1. **只表达状态变化**——入场、切换、反馈。不做事后装饰：无背景粒子、无循环漂浮、无自动轮播。
2. **只用 `opacity` + `transform`**——不触发 layout / paint 重排。`height` 类动画仅在既有 shadcn accordion 内保留。
3. **时长分档**：微反馈（hover / active / focus）120–160ms ｜ 元素入场（列表项、卡片）220–280ms ｜ 页面与区块切换 260–320ms。**上限 400ms**，超过即"慢"。
4. **`prefers-reduced-motion` 全局兜底已存在**（`globals.css:67-76`，`animation-duration: 0.01ms !important`），新动效自动继承，无需逐个处理。

**动效词汇表**（token 化落于 `tailwind.config.ts`）：

| 名称 | 用途 | 定义 |
|---|---|---|
| `fade-in` | 通用淡入、tab 切换 | opacity 0→1，220ms |
| `rise-in` | 内容入场（淡入 + 上移 8px） | opacity + translateY(8px)→0，260ms |
| `page-enter` | 路由切换 | opacity + translateY(6px)→0，280ms |
| `stagger-item` | 列表错峰 | 同 `rise-in`，delay 由 `--stagger` 变量控制，index 上限 8 |
| `sheet-in`（已有） | 下拉面板 | 保留 |
| `accordion-down/up`（已有） | 折叠 | 保留 |

**挂载点**：

1. **路由切换**——`AppLayout.tsx:517-521`。`<Outlet />` 外层包 `key={location.pathname}` 的 `div.animate-page-enter`。这是唯一天然挂载点（Suspense 在 shell **内部**，header / footer 不重挂）。用 `pathname` 而非 `location.key`：search params 变化（如 `?page=2`）不该触发整页入场。
2. **tab 切换**——各 Shell（`GalaxyShell` / `TopicShell` / `ProfileShell`）内容区，复用 `fade-in`，比页面级更轻。
3. **列表错峰**——列表容器每个直接子项写 `style={{ "--stagger": index }}`，类名 `animate-stagger-item`；CSS `animation-delay: calc(var(--stagger) * 40ms)`。**只在挂载时播放一次**，不做滚动触发。

**明确不做**：

- **滚动触发动画**（IntersectionObserver）——需 JS、伤性能、与测试环境相冲。
- **路由离场动画**——React Router 7 数据路由下离场需 `useTransition` + 双树，成本远超收益；入场足够传达"页面变了"。
- **骨架屏 shimmer**——现有 `PageState kind="loading"` 是文案态，改骨架需逐页定义骨架结构，属独立工程。

#### B. 插图体系（槽位制）

**做法变更（2026-10-13）**：内置抽象几何图**不再扩建**。插图改为**槽位制**——本方案只定义每个插图位的**尺寸规格**，具体图片由使用者提供，落地时填入槽位即可。

**槽位规格**（单一事实源：`src/components/shared/illustration-slots.ts`）：

| 槽位 | 位置 | 显示框（CSS px） | 比例 | 建议导出 @2x |
|---|---|---|---|---|
| `hero` | PageHero 右侧插图（入口型页面横幅，≥1024px 显示） | 168 × 112 | 3:2 | 336 × 224 |
| `notFound` | 404 页，居中于卡片上方 | 192 × 128 | 3:2 | 384 × 256 |
| `empty` | PageState 空态（整页或区块内） | 120 × 80 | 3:2 | 240 × 160 |

**替换方式**：在槽位表给 `src` 赋值——本地文件（`/illustrations/xxx.png`，放 `public/illustrations/`）或绝对 URL（在线占位图亦可）。全部调用点经 `IllustrationSlot` 渲染，**无需改任何 JSX**；未赋值时渲染内置 SVG 占位。

**图片契约**：图在框内居中、`object-contain`、**不裁切**——比例不符时留白而非被切。导出用 `export` 尺寸（2×）；透明底在 cream 背景上最干净，自带不透明底会露出矩形。

**只设三个槽，这是刻意的**：每处都放插图就从"信号"变成"噪音"。这三个是读者**没有别的东西可看**的状态——死路、空容器、入口横幅。`SectionState`（区块内状态）与错误页**刻意不放**：它们紧挨真实内容，插图在那里是干扰而非帮助。

**`PageHero` 槽宽度约束**：插图槽按 `hero` 槽宽度（168px）封顶。文字列是 `min-w-0`，不封顶时一张宽图会在 1024–1280px 静默挤压标题——那个区间两列已并排、但 shell 仍然很窄。

**内置占位图红线**（`illustrations.tsx` 文件头已立，沿用不改）：抽象几何、扁平、无渐变、无具象人物；`aria-hidden`；token 必须 `hsl(var(...))` 包裹；金描边走 `--accent-strong`（`--accent` 只用于能承载它的实心形状）。

#### C. 表面细化（UI 美化）

**原则**：不做"换皮"。`tokens.css` 是唯一 token 源，品牌色（Navy / Cream / Gold）与语义色值**一律不动**。只做层次、反馈、节奏三项：

1. **层次**——当前所有表面是纯边框无阴影，层次全靠边框。增加两级极轻阴影（**色用 `--foreground` 而非纯黑**，避免发灰）：
   - `shadow-surface`：`0 1px 2px hsl(var(--foreground) / 0.04)`——静态卡片
   - `shadow-lift`：`0 4px 12px -2px hsl(var(--foreground) / 0.08)`——hover 抬升
2. **反馈**——**可点击**卡片 hover 统一为"边框提亮 + 微抬升"：`transition-[transform,box-shadow,border-color] duration-150` + `hover:-translate-y-0.5 hover:shadow-lift`。**纯展示卡片不抬升**——避免"看起来可点但实际不可点"的错觉。
3. **节奏**——`section-gap` 已是 `gap-8`；补 `.section-gap-tight`（`gap-6`）给内容流密集页。

**红线**：不加装饰性渐变、不加背景纹理、不给非交互元素加 hover 反馈。

**落地结论（2026-10-13，批次 08 收尾）**

| 项 | 落地形态 | 依据 |
|---|---|---|
| 层次 · `shadow-lift` | ✅ 保留，唯一阴影档 | 语义收敛为「**这个表面离开了页面**」：用户只有两个——`.card-lift:hover`（卡自身是链接，抬升）与 toast 浮层（`toast.tsx`，浮起的卡片「where a mismatch shows most」）。静态卡一律无阴影 |
| 层次 · `shadow-surface` | ❌ **弃用（已从 config 删除）** | 见下方「为什么只有一个阴影」 |
| 反馈 · `card-lift` | ✅ 已落地 | 批次 07–08 迁移；判据与两处例外见 §4.3 ⑤ / ⑤b |
| 节奏 · `.section-gap-tight` | ✅ 已接线 4 处 | `PendingAuditPage` / `EventDetailPage` / `EventsPage` / `EventSubmitPage`——四处都是「同一种块在同一列」，此前各自手写 `flex flex-col gap-6` |

**为什么只有一个阴影（`shadow-surface` 弃用判据）**。初版这一条写反了方向：它把「所有表面是纯边框无阴影」当成**缺失**，实际那是**决定**。三条实证：

1. **阴影哲学是显式的，不是缺省。** `tailwind.config.ts` 注释逐字：「**surfaces here are border-first**, and the shadow only separates a raised card from the page, it does not model a light source.」首页 feed 面板与公告面板**显式**写 `shadow-none`（全库 4 处 `shadow-none` 里 2 处就是这两个静态大面板）——如果是默认缺省，没人会去写 `none`。
2. **零用户，且规划落点与哲学相反。** 构建产物核验：`0 1px 2px …0.04` **不在** `dist` 的 CSS 里（被 tree-shake）；全库零引用。而规划落点是「静态卡片」= 全站 ~99 处静态卡。4% 不透明度铺 99 处，正是红线里的**滥用**。
3. **接线是高风险且不可验证的动作。** 现状（纯边框）是已交付、已视觉验证的；4% 阴影在 cream 上肉眼近不可见，**铺开后无法视觉验证**——收益为零，风险是「全站表面观感悄悄漂移」。

**同时删除的还有两个孤儿类**：`.surface-card` / `.surface-compact`（`globals.css`）。判据不是「有没有用」，而是**「接线后能否 grep 出旧形态」**——迁移批次的实际工作方式就是 `grep "rounded-lg border border-border"` 找旧表面，把 106 处收编进 `.surface-card` 后新旧表面不再可辨，会**摧毁 grep 审计能力**；`.surface-compact` 更直接——全库没有这个形态。两处删除的原因都已在源码原位留注释，防止未来重新加回。

---

## 七、与现有代码的衔接

### 7.1 保留不动

| 资产 | 位置 | 原因 |
|---|---|---|
| Shell（header/main/footer/Suspense 边界） | `src/layouts/AppLayout.tsx` | 结构正确，断点与无障碍已修 |
| `.content-shell` 等工具类与 token 体系 | `src/styles/globals.css`、`tokens.css` | 本方案全部栅格建立在其上 |
| 首页 feed+rail 栅格 | `HomePage.tsx:239` | 方向正确，仅压缩欢迎区 |
| 设置页栅格 | `SettingsLayout.tsx` | 即 S7 模式 |
| AuthLayout narrow/wide | `AuthLayout.tsx` | 即 S8 模式 |
| 文章正文排版 `.article-body` | `globals.css:155-219` | S5 阅读样式基础 |

### 7.2 需要调整

| 页面 | 文件 | 调整内容 | 状态 |
|---|---|---|---|
| 首页 | `features/home/pages/HomePage.tsx` | 欢迎区实测已达标（94px / 25px），本批只做组件迁移 | ✅ |
| 发现页 | `features/discover/*` | 组件顺序调整 + 入口降级为 chips；**未**新建 bento | ✅ |
| 星系广场/详情 | `features/galaxies/*` | 卡片信息结构、身份头、教学区 | ✅ 批次 03 |
| 创作中心 | `features/studio/*` | 去卡片矩阵，任务驱动 | ✅ 批次 06 |
| 编辑器 | `features/studio/*`（编辑器页） | 独立全宽布局，脱离 content-shell | ✅ 批次 06 |

### 7.3 新增骨架组件（建议）

| 组件 | 用途 | 备注 |
|---|---|---|
| ~~`BentoGrid`~~ | ~~发现页差异权重网格~~ | **不新建**：`DiscoverFocusGrid` 已达成差异权重（见 §3.2 偏离 ②） |
| `IdentityHeader` | 星系/个人主页身份头 | 两个页面共用，尺寸档可配 |
| `ReadingShell` | 阅读类布局（正文 + 目录） | 文章/公告/指南/系列共用 |
| `WorkbenchShell` | 工作台布局（左导航 + 主区） | 创作中心/设置共用 |

### 7.4 批次 01–08 实际产出（文件级记录）

#### 批次 01–02

| 动作 | 文件 | 说明 |
|---|---|---|
| 新增 | `src/components/shared/PageMasthead.tsx` | 无表面页头。由首页私有 `HomeMasthead` 提升为共享件——两页需求完全相同，再造近似副本即是本代码库别处警告过的重复 |
| 删除 | `src/features/home/components/HomeMasthead.tsx` | 内容即 `PageMasthead`；保留会留下一份永不更新的近似副本 |
| 删除 | `src/features/discover/components/DiscoverHero.tsx` | 仅 14 行，是 `PageHero compact` 的包装，被 `DiscoverPage` 唯一引用 |
| 修改 | `src/features/home/pages/HomePage.tsx` | 仅 import 路径与组件名 + 注释；**页面组合未变** |
| 修改 | `src/features/discover/pages/DiscoverPage.tsx` | 顺序重排（说明行 → 精选 → 探索入口）+ 注释 |
| 修改 | `src/features/discover/components/ExploreTopics.tsx` | 卡片块 → chips 行；错误态去表面；契约全保留 |

**未触碰**：`PageHero.tsx`（`/moments`、`/galaxies`、`/series` 仍在用，且应该继续用——它们是入口型页面，横幅式标题 + 插画在那里是有效的）、`AppLayout.tsx`（批次 06 因编辑器例外才动，见下）、`.content-shell` 与 token 体系、`DiscoverFocusGrid.tsx`。

**验证（批次 01–02）**：`npm run typecheck` ✅ ｜ `npm run test` ✅ 210 文件 / 2335 用例全绿 ｜ `npm run lint` ✅ 0 error（改动文件 0 warning）｜ `npm run format:check` ✅ ｜ `npm run build` ✅ ｜ `check:bundle` ✅ 首屏 gzip 159KB / 200KB 预算（77.8%），entry 泄漏扫描 10 项标记全 0，悬空 chunk 引用 0。

#### 批次 03–06

| 动作 | 文件 | 说明 |
|---|---|---|
| 新增 | `src/lib/stagger.ts` + `stagger.test.ts` | 错峰入场延时（40ms 步长、8 阶封顶）。**必须走 inline style**——`animate-rise-in` 是 animation shorthand，会重置 `animation-delay` |
| 新增 | `src/components/shared/illustration-slots.ts` | 插图**槽位制**：只定尺寸不产图。3 个槽位 hero 168×112 / notFound 192×128 / empty 120×80（均 3:2，@2x 导出 336×224 / 384×256 / 240×160） |
| 新增 | `src/features/topics/components/TopicsFilterBar.tsx` | 话题搜索独立成 sticky 筛选条（原为 `TopicsHero` 内的一块） |
| 删除 | `src/features/topics/components/TopicsHero.tsx` | 内容已由页头 + 筛选条分担；纯删除，零残留引用 |
| 新增 | `src/features/profile/components/ProfileWorksFilter.tsx` | 个人主页的分类筛选（替代无数据源的三个 tab） |
| 新增 | `src/features/studio/components/` | `WorkbenchShell` + `StudioNav`：工作台左导航，全 `/studio` 路由共用 |
| 新增 | `src/features/studio/pages/studio-page.test.tsx` | 303 行 / 15 条用例，钉死三源独立降级契约 |
| 修改 | `src/features/studio/pages/StudioPage.tsx` | **最大单件（382 行改动）**：卡片矩阵 → 任务驱动 |
| 修改 | `src/features/series/pages/PublicSeriesReadPage.tsx` | 336 行改动：字号控件修复 + ch 度量 + 侧栏 sticky 修正 |
| 修改 | `src/features/galaxies/pages/GalaxyListPage.tsx` | 220 行改动：搜索独立 + `MineStrip` chips + 教学区压缩 |
| 修改 | `src/features/topics/pages/TopicsPage.tsx` | 202 行改动：四层重排 + 关注闭环 |
| 修改 | `src/features/profile/pages/UserProfilePage.tsx` + `components/ProfileWorks.tsx` | 131 / 152 行改动：S4 身份头 + 主栏/侧栏 + 分类筛选接线 |
| 修改 | `src/features/article/pages/ArticleDetailPage.tsx` | 149 行改动：封面与文末三块收进 68ch + 评论改列表单 |
| 修改 | `src/features/topics/components/TopicCard.tsx` | 148 行改动：分隔线行 → 卡片网格 |
| 修改 | `src/features/studio/pages/ContentListPage.tsx` | 135 行改动：工具栏补上搜索 |
| 修改 | `src/features/galaxies/components/GalaxyTile.tsx` | 108 行改动：卡片信息结构重做（认证徽章 + 一句话定位） |
| 修改 | `src/features/studio/pages/StudioCategoriesPage.tsx` | 删除 `categoryPathHint` 虚假地址 + 清 `useAuth` 死链 |
| 修改 | `src/layouts/AppLayout.tsx` | 编辑器路径 `<main>` 去 `content-shell`；路由级入场 `key={pathname}` |
| 修改 | `src/styles/globals.css` / `tokens.css` / `tailwind.config.ts` | 77 / 25 / 65 行：动效 keyframe、`.reader-column`、焦点环、表面工具类 |

**红线扫除（批次 06 一并完成）**：109 处 `text-accent` → `text-accent-strong`（纯金在白底 2.13:1 / 奶油底 1.97:1，不达 AA）；焦点环 `--ring` 由金色改为 `--accent-strong`（实测 white 5.05:1 / cream 4.68:1 / muted 4.17:1 / sunken 4.31:1，原金色分别 2.13/1.97/1.76/1.82 全不达 3:1；navy 底 7.47→3.15 仍达标）。

**验证（批次 03–06 收尾复核，2026-10-13）**：`npx tsc --noEmit` ✅ 0 错误 ｜ `npx vitest run` ✅ **212 文件 / 2384 用例全绿**（58.1s）｜ `npm run lint` ✅ 562 文件扫描、0 error / 35 warning（35 条全为既有：本批新增文件 0 条；落在改动文件上的 2 条——`PublicSeriesReadPage.tsx:152`、`StudioCategoriesPage.tsx:99`——经 diff 行号区间核对确认未被触碰）｜ `npm run format:check` ✅ 全部符合 Prettier ｜ `NODE_OPTIONS="" npm run build` ✅ 2.23s ｜ `npm run check:bundle` ✅ 首屏 gzip 160KB / 200KB 预算（78.4%），entry 泄漏扫描 10 项标记全 0，悬空 chunk 引用 0。

#### 批次 07–08

| 动作 | 文件 | 说明 |
|---|---|---|
| 新增 | `src/features/auth/components/AuthCaptchaImage.tsx` | 登录与注册各自手画的验证码图（两份都从旁边的控件漂移：`h-10 rounded` 对 `h-9 rounded-md`，图比字段上下各悬出 2px）。`shrink-0` 承重——旁边的 `Input` 是 `w-full`，窄屏下 flex 行会压扁验证码而不是字段 |
| 修改 | `src/features/events/pages/EventsPage.tsx` | 163 / 33：页头换 `PageHero`；`rounded-lg` 旧语言清退；**刻意不用** `card-lift`（只有卡内两个控件是链接） |
| 修改 | `src/features/events/pages/MyEventsPage.tsx` | 149 / 64：单表面 + `key={tab}`（切 tab 时重播入场，否则新内容静默替换） |
| 修改 | `src/features/moments/pages/MomentDetailPage.tsx` | 90 / 44：新增互动条；**刻意不用** `card-lift`（卡内不止一个可点目标） |
| 修改 | `src/features/events/pages/EventDetailPage.tsx` | 90 / 25：活动状态优先 |
| 修改 | `src/features/events/pages/EventSubmitPage.tsx` | 90 / 23 |
| 修改 | `src/features/moments/pages/MomentsPage.tsx` | 82 / 31：删面板头（页头已陈述过同一件事，再写一遍是第二层白板） |
| 修改 | `src/features/moments/pages/MyMomentsPage.tsx` | 70 / 16（页头形态差异见 §4.2 实施记录 ⑪） |
| 修改 | `src/features/messages/ConversationRow.tsx` | 48 / 8：列表形状全库唯一——独立卡片 + `flex flex-col gap-2`（行自带未读态与 hover，分隔线两者都表达不了） |
| 修改 | `src/features/notifications/NotificationRow.tsx` | 42 / 7 |
| 修改 | `src/features/events/components/EventDateBlock.tsx` | 35 / 3 |
| 修改 | `src/features/messages/pages/MailboxPage.tsx` | 33 / 2 |
| 修改 | `src/features/notifications/toast/notification-toast.types.ts` | 30 / 6：`NEUTRAL_DISC`——后端目前只产出一类通知，为四类发明调色板等于四种没人见过的颜色 |
| 修改 | `src/features/moments/moment-detail-page.test.tsx` | 29 / 0：互动条契约 |
| 修改 | `src/features/notifications/toast/NotificationToaster.tsx` | 22 / 8：桌面右下角 / 移动端顶栏下，两套堆叠方向 |

**批次 07 合计**：`23 files changed, 1076 insertions(+), 296 deletions(-)`。按域：moments 4 files 271/91 ｜ events 5 files 527/148 ｜ messages 10 files 170/34 ｜ notifications 4 files 108/23。

**批次 08 合计**：`34 files changed, 670 insertions(+), 408 deletions(-)`。按域：me-growth 5 files 119/134 ｜ moderation 7 files 204/105 ｜ auth 6 files 76/29 ｜ onboarding 1 file 91/35 ｜ collections 3 files 51/30 ｜ announcements 2 files 50/10 ｜ social 2 files 24/15 ｜ feedback 1 file 20/20 ｜ me-activity 2 files 12/22 ｜ guide 2 files 12/2 ｜ bookshelf 1 file 5/3 ｜ creators 1 file 4/1 ｜ rules 1 file 2/2。单件 top：`OnboardingPage` 91/35 ｜ `MyGroupsPage` 67/76 ｜ `ReportDetailPage` 53/25 ｜ `AnnouncementsPage` 49/9 ｜ `MyReportsPage` 46/15 ｜ `NewReportPage` 33/19 ｜ `CollectionsPage` 30/21 ｜ `AuthCard` 29/7。

**批次 07–08 零删除。** 工作区累计的 3 个删除文件（`HomeMasthead` / `DiscoverHero` / `TopicsHero`）全部出自批次 01–04，已在上表登记。

**工作区累计（批次 01–08）**：`git status --short` = 132 项（12 未跟踪 / 3 删除 / 117 修改）；`git diff --shortstat` = `120 files changed, 4783 insertions(+), 1760 deletions(-)`。12 个未跟踪项里批次 07–08 只贡献 `AuthCaptchaImage.tsx` 一个，其余 8 个代码文件（`PageMasthead` / `illustration-slots` / `stagger` + `stagger.test` / `TopicsFilterBar` / `ProfileWorksFilter` / `studio/components/` / `studio-page.test.tsx`）分属批次 01–06，另 3 项（`前端Layout设计方案.md`、`信息优先级.md`、`提示词.txt`）是文档与提示词文本、非代码交付。

**验证（批次 07–08 收尾复核，2026-10-13）**：`npx tsc --noEmit` ✅ 0 错误 ｜ `npx vitest run` ✅ **212 文件 / 2384 用例全绿**（43.44s）｜ `npm run lint` ✅ 0 error / 35 warning（总数与批次 03–06 收尾持平；批次 07–08 新增的 `AuthCaptchaImage.tsx` 贡献 0 条，落在本批改动文件上的 9 条逐条与 `git diff --unified=0` 的新文件行号区间比对，**全部落在 hunk 之外**——是既有告警，不是本批引入）｜ `npm run format:check` ✅ 全部符合 Prettier ｜ `NODE_OPTIONS="" npm run build` ✅ 2.40s ｜ `npm run check:bundle` ✅ 首屏 gzip 160KB / 200KB 预算（78.4%），entry 泄漏扫描 10 项标记全 0，悬空 chunk 引用 0。

---

## 八、能力边界与降级策略（布局不假设功能闭环）

| 边界 | 来源 | 布局处理 |
|---|---|---|
| 星系成员数/内容数已确认（批次 03）：列表端点有 `description`、无 `contentCount` | 文档 §三.3 | 卡片只渲染成员数；「内容数」不画——画出来只能是编造 |
| `Topic` 无分类字段（批次 04 确认） | 文档 §三.3 | 筛选条收窄为搜索一项，不画分类 chips |
| 用户维度无 `/{username}/series`、`/{username}/moments`（批次 06 逐条核对） | 文档 §4.3 | 「作品流 tab」不画；改由创作空间分类承担第二维 |
| `/messages/saved` 缺收藏入口 | 文档 §三.6 | 入口补齐前不露出该页 |
| 协作邀请无后端落库 | 文档 §三.7 | 接受页 P1 卡片明示"不代表获得协作权限" |
| 热门/趋势/个性化排序未支持 | 文档 §四 | 筛选器只放真实能力，不画虚假 tab |
| 空数据 | 全站 | 用 PageState 引导操作，禁止占位卡片矩阵 |

---

## 修订记录

| 日期 | 批次 | 变更 |
|---|---|---|
| 2026-10-13 | 01 首页 | 复核确认已达标，**无代码改动**。`HomeMasthead` 提升为共享 `PageMasthead`（为批次 02 铺路，两页需求相同）；§3.1 补实测高度表，替代表述性预算 |
| 2026-10-13 | 02 发现页 | 顺序改为"说明行 → 精选 → 探索入口"；`DiscoverHero` 删除；`ExploreTopics` 降级为 chips 行；**未**新建 bento 网格（`DiscoverFocusGrid` 已达成目标，偏离记录见 §3.2）；§3.2「≤80px」估值修正为实测 94px；§7.3 `BentoGrid` 标记为不新建；新增 §7.4 文件级产出记录 |
| 2026-10-13 | 范围扩展 | 用户要求纳入**动效 / 插图 / UI 美化**。删除文首"不涉及视觉皮肤细节"的自我限定；新增 §6.2「横向工程」：动效四条约束 + 词汇表 + 三个挂载点 + 三项"明确不做"；插图扩建清单 5 张 + `PageState` 向后兼容的接入方式；表面细化三原则 + 红线 |
| 2026-10-13 | 03.0 基础设施 | §6.2-B 插图做法**再变更**：内置几何图不再扩建，改为**槽位制**（只定尺寸、图片由使用者提供），3 个槽位规格表 + `IllustrationSlot` 渲染器 + `PageHero` 槽宽封顶。动效落地：`fade-in`/`rise-in`/`page-enter` 三个 keyframe + 路由入场挂载于 `AppLayout`（`key={pathname}`）；fill-mode 用 `backwards` 而非 `both`——保留的 `translateY(0)` 仍是 transform，会永久让该层成为 fixed 后代的包含块。表面：`shadow-surface`/`shadow-lift`（用 `--foreground` 调色）+ `.section-gap-tight` + `.card-lift`（只给整卡可点的元素） |
| 2026-10-13 | 03 星系广场 + 详情 | 广场三处结构改动：搜索移出 `PageHero.actions` 并置于「我的星系」之上（搜索时该块整块隐藏，搜索框原地不动）；`MineStrip` 由第二个 `GalaxyGrid` 改为横向 chips（两个同款网格读起来像一份列表被切成两半）；教学区压成两行文本。`GalaxyTile` 信息结构重做：认证改名称旁徽章、「内容数」删除（列表端点不返回 `contentCount`）、出口统一「查看星系 →」。实施记录见 §3.4 |
| 2026-10-13 | 04 话题广场 + 详情 | 重排为「页头(P3) → 筛选条(P1 sticky) → 网格(P0) → 引导(P3)」；`TopicsHero` 删除、`TopicsFilterBar` 新建；卡片网格由分隔线行改 `gap-3`。**一条过时禁令被推翻**：话题关注端点 404 已于 2026-10-10 修复，`topics-page.test.tsx` 的「无关注按钮」断言改为三条正向测试。筛选条三坑：`type="text"` 保 role 查询、无第二个 `role="status"`、`bg-card` 对 sticky 是必需项。实施记录见 §3.3 |
| 2026-10-13 | 05 系列 / 文章 | **修掉一个真缺陷**：系列阅读器的字号控件（A-/A+）是坏的——`.article-body` 自声明 `text-[15px]`，声明在元素本身压过从 wrapper 继承的 `font-size`，而 `ch` 相对元素自身字号解析，于是按钮只让行宽变宽变窄、字形恒为 15px。修法两条：正文内部尺寸改相对单位（`h2 1.3333em` / `h3 1.0667em` / `h4 1em` / `code`·`table 0.8667em`，避免正文放大时大纲倒置）+ 新增 `.reader-column .article-body { font-size: inherit }`。度量由 px 改 `ch`（`680/820/960` → `58/68/80ch`）：px 行宽与 px 字号不成比例，且 `960` 物理不可达（1200 − 256 − 24 = 920px）。默认字号 18px。侧栏 `lg:self-start` 承重（flex 行默认拉伸子项，满高 `<aside>` 零行程会让 sticky 静默失效）。文章详情三处收窄：封面 675px 横幅 → 68ch 约 340px；文末三块从 1200px 收进 68ch；评论改发丝分隔列表。`toggleLike` 乐观更新缺陷改快照恢复。实施记录见 §3.5 |
| 2026-10-13 | 06 创作中心 + 个人主页 | `/studio` 由六卡矩阵改任务驱动（P0 继续创作 + 写新文章并排 / P1 待处理紧凑行 / P2 一行数字 / P3 功能入口刻意缺席）；六个目的地在 `StudioNav` 单点渲染，不在本页复制（两份副本会产生相同 accessible name，屏幕阅读器重复链接 + role 查询二义）；三源独立降级（`getMyHome` / `listMine` / `meInsights` 并行、各自持状态）；`/studio/content` 补搜索（**限当前 tab 内**，跨 tab 与「回收站」语义矛盾）；编辑器 `<main>` 去 `content-shell`（正则落在 `AppLayout`）。个人主页身份头由全宽改 `lg:grid-cols-[minmax(0,1fr)_300px]`；**§4.3「作品流 tab」被推翻**——用户维度端点无 series 也无 moments，三个 tab 里两个无数据源，改由创作空间分类承担第二维；筛选状态存本地 state 而非 URL，并删除 `categoryPathHint` 虚假地址。红线扫除：109 处 `text-accent` → `text-accent-strong`；焦点环 `--ring` 由金色改 `26 90% 37%`（实测 white 5.05:1 / cream 4.68:1 / muted 4.17:1 / sunken 4.31:1，原金色分别 2.13/1.97/1.76/1.82 全不达 3:1）。实施记录见 §3.6；收尾六项校验全绿（实测数字见 §7.4）|
| 2026-10-13 | 07 动态/活动/私信 | 四域**表面 / 字号 / 动效**三类规则 + 四处结构改动。**表面**：events 域的 `rounded-lg` 是旧语言，四域卡片统一到 `rounded-xl border border-border/70`。**字号**：events 是全库最密集的域（29 处 `text-xs` + 13 处 `text-[10px]`），全收进 `text-meta`，唯一例外是状态 chip 保留 11px——**chip 是徽章不是散文，13px 塞进 2px padding 的 pill 里读成一个色块**；messages 立下「散文 `text-meta` / 微标签 `text-[11px]` / 控件留 `text-sm`」。**动效三条判据**：错峰（`stagger.ts` 40ms 步长 8 阶封顶，**必须走 inline style**——`animate-rise-in` 是 animation shorthand，会重置 `animation-delay`）、不 replay、跨天列表按天重起算。**四处结构改动**：`MomentsPage` 删面板头、`MomentDetailPage` 新增互动条、`EventsPage` 换 `PageHero`、`MyEventsPage` 单表面 + `key={tab}`。messages 的列表形状是全库唯一（独立卡片 + `flex flex-col gap-2`）：**行自带未读态与自己的 hover，分隔线两者都表达不了——那是形状不是疏忽**。`NotificationToaster` 桌面右下角向上堆叠 / 移动端顶栏下向下堆叠（手机上视口底部同时属于浏览器 chrome 和拇指）。`NEUTRAL_DISC`：后端目前只产出一类通知，为四类发明调色板等于四种没人见过的颜色。实施记录见 §4.2 |
| 2026-10-13 | 08 设置/记录/认证/治理 | **页头语言统一**：权威形态 `border-b border-border/70 pb-5` 从本批开始时的 8 处扩到 29 处命中（27 处真实代码 = 26 个页面级 `<header>` + `PageHeader.tsx:56` 自身定义，另 2 处是注释引用）。记录 / 治理 / 工具页的页头一律**不带卡片表面**——页头是「关于页面的陈述」而不是「记录」，给它边框平面会让它在下方 section 之上变成第二层白板；两条全库核查支撑该判断：15 处带图标的 h1 **全部**落在卡片式页头里、零反例；另 15 处卡片式页头逐一查过、**零处**带「刻意保留」注释——它们是存量，不是设计。表面升档 32 删 → 25 增；`text-accent-strong` 补扫 29 处；手写控件补焦点环 2 处；`card-lift` 迁移 2 处。**认证域 L1 = 20px**（5 个 h1 里 4 个合规，唯一例外 `/register` 宽栏态保留 24px）；`AuthCard` 原写 `text-card` 是错的——tokens 改档后它是 15px 的「卡片 / 行主文本」档，而认证页会在状态切换时跳字号（**提交一次标题长高 5px，不是层级，是两套规格撞在一起**）。`AuthCaptchaImage` 抽取：登录与注册两份手画副本都从旁边的 `Input` 漂移（`h-10 rounded` 对 `h-9 rounded-md`），**一个控件行只有一个高度**；`shrink-0` 承重，否则窄屏会压扁验证码而不是字段。`AnnouncementsPage` 是共享 `PageHeader` 的**全库第一个真正使用者**（此前零调用）。**三组存量待处置**（非本批引入，**后续批次已全部收口**，见下行）：① `text-accent` 残留 7 处——4 处是有语义的图形、3 处是纯装饰，其中 2 处带透明度修饰符，换 token 是改设计而不是补扫；② `card-lift` 与 `hover:border-accent-line` 并存 2 处（`StudioPage:170` / `TopicCard:57`，批次 03–06 产物，金色技术上生效、不是 bug，但语义冲突）；③ 「整卡链接缺 `card-lift`」候选 4 处——`GalaxyMembersPage:74` / `MyGalaxiesPage:110` 是整卡 `<Link>` 且还带 `hover:border-accent` 旧写法 + `rounded-lg` 旧表面（与 `card-lift` 自带的 `border-color` 过渡语义冲突）；`ConversationRow:82` 是整卡 `<Link>`；`CommunityEventsPanel:77`（实际在 `features/home/`，不在 events）是侧栏紧凑行，`rounded-md` / `p-2.5` 的抬升可能过重，需逐处定夺。实施记录见 §4.3 / §4.5 / §4.6 |
| 2026-10-13 | 存量收口（§4.3 三组） | **批次 08 登记的三组存量全部处置完毕，代码与文档一致。** ① `text-accent` 残留 7 处——**全部保留纯金，判据 7/7 落盘**：它们都不是文本，`--accent-strong` 的适用域是文本；两处状态指示器（Heart / Bookmark）已用填充 + 计数/标签双重编码，颜色不是唯一载体，不受 1.4.11 约束。`HomeFeedItem` 把这条写成**「语义分色」**——同一次交互里图形保留纯金、文本走 strong，这正是双 token 并存的**设计意图**。② `card-lift` 与 `hover:border-accent-line` 并存 2 处——**两处不同解**：`StudioPage` **保留两者**（该卡静止态即金色，`.card-lift:hover` 会把它拉回灰色，`hover:border-accent-line` 在那里是**修正**；`GalaxyTile` 的 `mine` variant 同类）；`TopicCard` **删 `card-lift`**（关注按钮使容器降级为 `<article>`，抬升是谎），`group` 下移到图标行以保住 `TopicVisual` 的 `group-hover`。③ 「整卡链接缺 `card-lift`」候选 4 处——**两迁两留**：`GalaxyMembersPage` / `MyGalaxiesPage` 迁入 `card-lift focus-ring` + `rounded-xl border border-border/70`，删 `hover:border-accent`；`ConversationRow`（状态驱动表面 + 紧凑命中行）与 `CommunityEventsPanel`（首页 rail 紧凑行，表面语言由 rail 决定）保留。**关键实证**：`hover:border-accent-line` 胜出 `card-lift:hover` 的机制是**层叠顺序**（构建产物实测 `.card-lift:hover` @6617 < `.hover\:border-accent-line:hover` @46953），不是文档此前写的「race」——措辞已更正。**三条方法论留痕**：层叠关系必须实测；同类冲突不一定同解（判据是「静止态是否已是金色」）；删 `group` 前必须 grep `group-hover`。收尾六项校验全绿（`tsc` 0 错 / `vitest` 212 文件 2384 用例 / `lint` 0 error / `format:check` / `build` / `check:bundle` 首屏 gzip 160KB·78.4%）。实施记录见 §4.3 ⑤ / ⑤b / ⑤c |
| 2026-10-13 | 孤儿基础设施收口（§6.2-C） | **四个孤儿（已建、零引用的基础设施）全部处置：一接三删。** `.section-gap-tight` **接线 4 处**（`PendingAuditPage` / `EventDetailPage` / `EventsPage` / `EventSubmitPage`，此前四处各自手写 `flex flex-col gap-6`）；`shadow-surface` / `.surface-card` / `.surface-compact` **删除**。**判据（本批新立）**：孤儿的处置标准不是「有没有用」，而是**「接线后能否 grep 出旧形态」**——迁移批次的实际工作方式就是 `grep` 找旧表面，抽象会摧毁审计能力，故 `.surface-card`（定义恰是全站标准表面、会吞掉 106 处手写点）必须删；`.section-gap-tight` 因新旧仍可辨而通过。**`shadow-surface` 的独立否决**：① `tailwind.config.ts` 逐字写明「surfaces here are border-first」+ 首页面板显式 `shadow-none`（全库 4 处 `shadow-none` 中 2 处是静态大面板）⇒ 无阴影是**决定**不是缺失；② 构建产物核验其 CSS 被 tree-shake、全库零引用，而规划落点是 ~99 处静态卡（4% 铺开 = 红线「滥用」）；③ 接线无法视觉验证（4% 在 cream 上近不可见），收益零风险非零。**连带发现**：`shadow-lift` 语义收敛为「**表面离开了页面**」——用户只有 `.card-lift:hover` 与 toast 浮层两个（`toast.tsx` 注释「a floating card is where a mismatch shows most」），config 注释已按此重写。收尾六项校验全绿（`tsc` 0 错 / `vitest` 212 文件 2384 用例 / `lint` 0 error / `format:check` / `build` / `check:bundle` 首屏 gzip 160KB·78.4%）。实施记录见 §6.2-C |
| 2026-10-13 | 切换动效收口（§6.2-A） | **§6.2-A 挂载点 2 的前提被推翻**：原文点名 `TopicShell` / `ProfileShell` 内容区复用 `fade-in`，实测**两个 Shell 都不存在**（全站仅 `GalaxyShell` / `WorkbenchShell`），且 `GalaxyShell` 的 tab 是**链接式导航**（切换即路由变化，`animate-page-enter` 天然重播）⇒ 该挂载点本就无需动效。**真正的缺口是同页按钮式 tab**，全站 13 处切换控件普查后定出 3 处并全部落地：① `HomePage` feed tab —— `features/home` 整目录此前零 `animate-*`，是全站唯一没有入场动效的主要页面；② `OnboardingPage` 域 tab —— `fade-in` 词汇表标注的「tab 切换」用途**唯一剩下的落点**（下方是整片标签云不是列表，没有「逐项到达」可表达，位移只会让八个域看起来像页面在抖）；③ `GalaxyContentPage` 筛选（类型 chips + 仅看置顶）。**重播机制 = `key` 落在列表容器上**（新 key 卸载列表 → `backwards` fill 重放），全站原有仅 2 处（`MyEventsPage:266` / `ProfileWorks:75`），本段 +2。**键位三则**：`HomePage` 键落 `<ul>` 而**不落**外层带边框的 `<section>`（section 拥有边框与底色，重挂会让面板轮廓在自己行下方闪断）；`GalaxyContentPage` 键必须**同时**编码 `filter` 与 `pinnedOnly`（对读者是一个筛选，只跟踪其一则一半切换重播、一半不重播）；键只随 tab 变、不随行数据变。**判据（与 §4.2 同源）**：读者主动换内容 ⇒ 重播；行内操作（点赞/已读/收藏）⇒ 不重播。**测试断言取节点身份而非类名**：只断 `animate-rise-in` 时**删掉 `key` 仍会通过**（假阳性），故断言 `closest("ul")` 的引用不等；另加反向锁（点赞后行节点不变）。**变异验证已做**：临时摘掉两处 `key` → 3 处断言精确变红（失败信息即「同一个 `<ul>` 节点」）→ 已还原。收尾六项校验全绿（`tsc` 0 错 / `vitest` 212 文件 2384 用例 / `lint` 0 error / `build` 2.14s）|
| 2026-10-13 | 孤儿复核（§6.2-C 续，**未处置**） | 复核范围扩到 `src/components/ui/`，发现 **17 个零引用 shadcn 组件**（38.5KB），与 §6.2-C 的四个孤儿**不同类**：那四个是**抽象层**（`.surface-card` 会吞掉 106 处手写点、摧毁 grep 审计）故判据「接线后能否 grep 出旧形态」直接适用 ⇒ 删；这 17 个是**未接线的能力**（没有手写点会被它们替换）⇒ 判据不适用。清单：`accordion` `alert` `breadcrumb` `checkbox` `dialog` `dropdown-menu` `popover` `progress` `scroll-area` `select` `separator` `sheet` `skeleton` `switch` `tabs` `toaster` `tooltip`（时间戳全为 `2026-10-12 11:46` = 一次性 `shadcn add` 批量拉入）；活件十个：`button`(73) `card`(14) `input`(13) `label`(8) `toast`(5) `password-input`(4) `avatar`(2) `textarea`(1) `table`(1) `badge`(1)，`ui/` 下无 barrel。牵连 **12 个零使用者 radix 包**（`accordion`/`checkbox`/`dialog`/`dropdown-menu`/`popover`/`progress`/`scroll-area`/`select`/`separator`/`switch`/`tabs`/`tooltip`，另 `react-visually-hidden`），仍在用 4 个（`react-avatar`/`react-label`/`react-slot`/`react-toast`）。**零运行时成本**：vite 只打包被 import 的模块 ⇒ 17 个文件不进 bundle（`check:bundle` 首屏 160KB 不受影响）⇒ 非缺陷、不必即修。**未删理由**：① 超出本批范围（作业规范：只改用户指定的模块，保留无关文件）；② 清依赖需改 `package.json` + 重生成 lock，属基础设施决策。附：`ui/tabs.tsx` 与项目 tab 惯例**形态不同**（shadcn 胶囊式 `bg-muted` + `data-[state=active]:shadow` vs 项目下划线式 `border-b-2 border-accent`），其 `shadow` 还会引入 §6.2-C 刚收敛掉的第三个阴影用户 ⇒ 将来即便接线也需改写 |
| 2026-10-13 | 断点级视觉回归（768/812/1024） | **MEMORY 待办 #1 收口，两个历史踩坑点实测验证已修复。** 方法：真实 Chrome（DevTools MCP）+ 后端在线（:7779），9 条公共路由 × 3 断点逐页量测（`scrollWidth/clientWidth`、全元素右缘越界扫描、`main` 左缘/宽度、控制台）。**坑 1（768–812 导航溢出 45px）**：主导航 `lg:flex` 于 <1024 隐藏，改走条件渲染移动面板——`aria-expanded` 正确、7 链接双列 + 搜索框 + 创作/登录 CTA、面板全宽贴合（752.8/753）、零溢出；9 路由 × 3 断点 `overflowX` 全部 ≤ 0，无一元素越出右缘。**坑 2（内容列 13.69px 横向跳动）**：`scrollbar-gutter: stable`（globals.css:50）computed style 实测生效；判据为**跨路由 `main` 左缘/宽度逐像素一致**——1024 断点 4 路由全部 50.56/910.08、812 断点 8 路由全部 39.84/717.11、768 断点 4 路由全部 37.64/677.51，文档高度 732–2315px 的矮/高页导航零位移。布局基准全程 `0.9 × (视口 − 15)` 连续无跳变（768 边界实测 676.8 → 677.51，斜率 0.9 平滑）；`md:px-6` 只改内边距不改 border-box。**量测注记**：页面无滚动条时 `documentElement.clientWidth` 报告全宽，但布局基准仍含 15px gutter（`main` 宽度 = 0.9 × (innerWidth − 15) 可证）——量测横向对齐时以 `main.getBoundingClientRect()` 为准，勿信 clientWidth。**新发现（未处置，非缺陷）**：1024–1100 窄带搜索框被 `max-w-sm flex-1` 挤压至 73px（1024: 73 → 1152: 186 → 1280: 300），占位符截断为「搜」；无溢出、可聚焦可用，处置属设计决策（如搜索入移动面板常驻 / 提前收进图标态），留给后续批次定夺。控制台干净（仅 vite dev 连接噪声） |
| 2026-10-13 | 搜索框窄带修复（1024–1279，接上行） | **上行「新发现」当日定夺并修复。** 机理：上行注释的 813px 账目**含 7 × 22px（16px 图标 + 6px gap）= 154px 导航图标**，lg–xl 区间它挤占的全是搜索框（1024 时仅剩 73px，占位符截断为「搜」）。方案：图标改 `hidden h-4 w-4 xl:block`（`AppLayout.tsx:369`）——图标本就是 `aria-hidden` 装饰件，lg–xl 退出 flex 行把 154px 让给搜索框（`gap` 不为 `display:none` 子项分配空间，净让出无残留）。**实测（真实 Chrome 逐宽度）**：1024 搜索框 73 → **224.86px**、1152 → **340.06px**、1280 图标恢复 `display: block`、搜索框 301.26px（≈原值）；`main` 左缘/宽度与基线**逐字一致**（1152: 56.84/1023.11、1280: 63.24/1138.31）⇒ 零布局回归；三宽度 `overflowX`/越界元素数全 0。判据：**空间紧张时牺牲视觉冗余（扫读加速的图标）保功能性控件（搜索）**，图标回归点与 xl=1280 重合，813px 账目注释已补记此变化。校验：`tsc` 0 错 / eslint 0 / prettier ✓ / `vitest` 212 文件 2384 用例 / `build` 2.14s / bundle 预算 OK |
| 2026-10-13 | 发现页空状态出口 + error 重试（接批次 02） | **MEMORY 待办 #3 收口，且排查中发现比「文案单薄」更严重的问题：空状态可能是死胡同。** `ExploreTopics` 无内容话题时自身 return null（`:44`/`:65`），而空 feed ⇒ 所有话题计数为 0 ⇒ 原形态全页只有「暂无内容 + 插图」、零出口（`DiscoverPage` 旧注释声称「探索行给读者一个去处」，该声称在此态不成立）。**修法一（空状态）**：文案覆写「社区还在生长中」+「还没有内容可以浏览。成为第一个分享的人吧。」+ 居中「去创作」→ `/studio`；形态对齐 `NewReportPage:126` / `GalaxyShell:288` 两处「空状态+出口」先例，容器取 `section-gap-tight`（按钮是状态附件非第二块）；测试安全（`discover-page.test.tsx` 只断 testid 不 pin 文案）。**修法二（error，连带）**：error 分支原为裸 `PageState`，补「重新加载」——`reloadKey` 重播模式（effect 依赖 `[reloadKey]`，按钮 `setReloadKey(k+1)`），不复制请求逻辑、保留每轮 effect 的 `active` 卸载守卫（提取 `loadFeed` useCallback 会丢掉 per-run 守卫，故不取）；形态对齐 `GalaxyShell:276`。**act 警告经 stash 对照实测为 pre-existing**（HEAD 版同样出现 2 次；首次实验假阴性已排除——stash 后 HEAD 版 import 已删的 `DiscoverHero`，测试未跑起来）。**系统性观察（未处置）**：全库 `kind="error"` 77 处仅 11 处带重试，66 处缺（横跨 30+ 文件），处置范围待定夺。校验：`tsc` 0 错 / eslint 0 / prettier ✓ / `vitest` 212 文件 2384 用例 / `build` 2.24s / bundle 预算 OK（78.4%、10 markers absent、dangling 0） |

---

*本方案为布局规划文档，随开发批次逐节落地；每批实施前以对应骨架小节为准，实施后如与《信息优先级.md》产生冲突，以信息优先级为准并回写本文档。*

