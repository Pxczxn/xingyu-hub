# 8 类页面骨架（SK1–SK8）· 静态原型 SK-C · v2 白底干净风

> **配色已于 2026-11-10 改为白底干净风**（用户定稿原话：「就白，干净点」）。
> 旧的「深蓝 #1A2138 + 米白 #F9F7F2 + 金 #F59E0B」已整体退场，参考站的蓝色 SaaS 皮肤也**没有照抄**：
> 画布纯白、卡片白 + 1px 发丝线、主按钮近黑，蓝色只留作功能性强调（每屏 ≤2 处）。

1. **怎么打开**：直接双击 `index.html`（Windows）或把它拖进浏览器 —— 纯 HTML + CSS，无脚本、无 CDN、无外部字体、无构建步骤，离线可看。
   每页顶部可在「适应宽度 58% / 1:1 原尺寸」之间切换：**排版总览看 58%，逐像素校对请切 1:1**。
2. **结构没重画**：8 屏的构图、首屏第一块、页数分布仍是 `.team/design/A-archetypes.md`（SK-A）那一套；本轮只做「重涂 + 对齐 + 删假数据」。
3. **文件改名了**：`archetype-1..8.html` → `sk1-reading.html … sk8-canvas.html`，与新 SK 编号一致，旧文件已删除。

## 一、8 个文件 ↔ SK 对应

| 文件 | 原型 | 页数 | 本屏取的真实页面（A §3） | 首屏第一块 | 非等高节奏（至少一处） | 蓝色出现在哪 |
|---|---|---|---|---|---|---|
| `sk1-reading.html` | **SK1 阅读栏** | 8 | `features/article/pages/ArticleDetailPage.tsx`、`features/announcements/pages/AnnouncementDetailPage.tsx`、`features/guide/pages/GuideDetailPage.tsx` | **正文标题**（标题就是正文首块，不作横幅） | 双栏 68ch + 220 目录轨；收尾 1.6fr + 1fr 非对称 | 1 处：目录当前项序号 |
| `sk2-gallery.html` | **SK2 画廊** | 17 | `features/discover/pages/DiscoverPage.tsx`、`features/topics/pages/TopicsPage.tsx`、`features/galaxies/pages/GalaxyListPage.tsx` | **等权卡格**（上压无卡面发现带 + 筛选条） | 非对称 1fr + 320 精选右栏；移动端卡转横排 | 0 处（选中筛选用近黑填充，比蓝色更强） |
| `sk3-console.html` | **SK3 控制台** | 22 | `features/studio/pages/StudioPage.tsx`、`features/studio/pages/ContentListPage.tsx`、`features/settings/pages/SettingsProfilePage.tsx` | **量化带**（28px/700 数字，一条通栏浅灰面） | 1fr 表格 + 280 右轨；底部通栏出血提示带 | 1 处：页签当前项下划线 |
| `sk4-inbox.html` | **SK4 收件箱** | 5 | `features/messages/pages/MailboxPage.tsx`、`features/messages/pages/ConversationThreadPage.tsx`、`features/notifications/pages/NotificationsPage.tsx` | **双栏列表**（[320 列表｜1fr 详情]，页面不滚、两栏各滚） | 定高双栏本身即非对称；消息面通栏出血 | 1 处：未读徽标 |
| `sk5-flow.html` | **SK5 流程** | 17 | `features/auth/pages/LoginPage.tsx`、`features/onboarding/pages/OnboardingPage.tsx`、`features/events/pages/EventSubmitPage.tsx` | **浅灰横幅**（#F7F7F8 + 上发丝线）+ 居中 720 窄栏 | 全宽出血横幅 + 居中窄栏；粘底操作条 | 1 处：当前步骤序号 |
| `sk6-feed.html` | **SK6 信息流** | 14 | `features/home/pages/HomePage.tsx`、`features/bookshelf/pages/BookshelfPage.tsx`、`features/profile/pages/UserProfilePage.tsx` | **行式条目**（[1fr 行式流｜300 右栏]，条目无卡面） | 首条 1fr + 208 图文非对称；右栏常驻 3 面板 | 1 处：页签当前项下划线 |
| `sk7-reader.html` | **SK7 阅读器** | 2 | `features/series/pages/PublicSeriesReadPage.tsx`、`features/rules/pages/RulesPage.tsx` | **吸顶阅读工具条 + 全幅出血头图** | 全幅出血头图；[256 目录｜measure] 居中 | 2 处：目录当前项竖线 + 进度条 |
| `sk8-canvas.html` | **SK8 创作台** | 1 | `features/studio/pages/EditorPage.tsx`、`features/studio/editor/**` | **画布**（[48 工具轨｜画布｜320 检视轨]，三栏各自滚） | 三栏本身非对称；画布不吃 content-shell | 2 处：工具轨当前块标记 + 选中块左边线 |

八屏「首屏第一块」两两不同：正文 · 卡格 · 量化带 · 双栏列表 · 横幅+窄栏 · 行式流 · 工具条+头图 · 画布。
每屏两组形态都在：`data-width="1440"` 与 `data-width="390"`，且各自带 `data-sk="SKn"`（`<body>` 上也有）。

**SK2 与 SK6 的区别**：SK2 首屏是**等权卡格**（3 列、卡即链接、卡有 1px 边 + 极轻阴影）；SK6 首屏是**行式条目**（无卡面、靠发丝线分隔）+ 右栏面板。
**SK1 与 SK7 的区别**：SK1 **没有工具条**、标题就是正文首块、整页滚动；SK7 有**吸顶工具条 + 全幅出血头图 + 左目录 256**。

## 二、旧名 → SK 映射（上一版 8 屏是怎么并进来的）

| 上一版（旧 gallery） | 现在归属 | 说明 |
|---|---|---|
| 长文阅读 | **SK1 阅读栏** | 直接对应，构图未变 |
| 主从分栏 | **SK4 收件箱** | 320 列表 + 1fr 详情 |
| 任务工作台 | **SK3 控制台** | 量化带 → 结构化主区 |
| 内容流 | **SK6 信息流** | 行式流 + 右栏 |
| 目录合集 | **SK2 画廊** | 目录页在 A 表里就是「多条目先扫后点」→ 卡格 |
| 设置表单 | **SK3 控制台（表格变体）** | A 表：settings 8 页全为 SK3·壳，页内不出 h1，主区是字段分组/表格 |
| 引导流程 | **SK5 流程** | 居中窄栏 + 粘底条 |
| 身份主页 | **归入 SK6 信息流** | A 表：UserProfile = 6 · 幅 · 紧 · 齐（横幅 + 行式流） |

被替换掉的两类（旧版没有）：**SK7 阅读器**（吸顶工具条 + 出血头图 + 左目录）与 **SK8 创作台**（三栏、无内容边距）。

## 三、色板 token（`style.css` 的 `:root`）

| Token | 值 | 用在哪 |
|---|---|---|
| `--canvas` | `#FFFFFF` | 画布、卡片、输入面（纯白，不是灰底） |
| `--surface-2` | `#F7F7F8` | 次级面：表头、代码块、量化带、选中底、SK8 两条侧轨 |
| `--ink` | `#111827` | 标题、数据指标、主按钮底 |
| `--ink-2` | `#374151` | 正文、阅读正文 |
| `--ink-3` | `#6B7280` | 可读辅助：时间、说明、eyebrow、表格表头 |
| `--ink-4` | `#9CA3AF` | **只**装饰与禁用（不承载可读文本） |
| `--placeholder` | `#C7CBD1` | 占位符专用 |
| `--line` | `#EAEAEA` | 发丝线（分隔、卡片边） |
| `--line-2` | `#DFE1E4` | 略强发丝线：chip 边、图标按钮边、引用竖线 |
| `--line-field` | `#878E96` | **输入框 / 开关轨道边界**（唯一过 1.4.11 的边界灰） |
| `--accent` | `#2563EB` | 功能蓝：选中 / 进度 / focus ring，每屏 ≤2 处 |
| `--accent-strong` | `#1D4ED8` | 蓝字 hover（本版实际未用，留给后续组件） |
| `--shadow-1/2/3` | `0 1px 2px` / `0 4px 12px` / `0 8px 24px`，alpha `.04/.06/.10` | 卡片 / hover / 浮层 |

字号：hero 44/34·**700** · 页面标题 32/26·**600** · 模块 22/19·600 · 卡片 17/16·600 · 正文 15 · 阅读 18/17 · 辅助 13 · 微 12；
数据指标 28/700（SK3 量化带）。字体只有一套系统栈（`Inter, -apple-system, …, "PingFang SC", "Microsoft YaHei"`），**不下载任何字体**，且不再有衬线标题。
圆角 **16**（普通卡片）/ **12**（输入框、小卡）/ **8**（标签、小按钮）；间距走 4/8/12/16/20/24/32/48/64/80，内容宽 **1280**（`--pad: 80px` @1440）；
动效 150/200/300ms，hover 只做背景加深或 `translateY(-2px)`。

## 四、对比度实测（WCAG 2.1 相对亮度公式，Node 实算，不是插件估算）

| 前景 / 背景 | 比值 | 门槛 | 用在哪 |
|---|---|---|---|
| `#111827` / `#FFFFFF` | **17.74** | ≥4.5 | 页面标题、卡片标题 |
| `#374151` / `#FFFFFF` | **10.31** | ≥4.5 | 正文、阅读正文 |
| `#6B7280` / `#FFFFFF` | **4.83** | ≥4.5 | 辅助小字（时间、说明、eyebrow） |
| `#6B7280` / `#F7F7F8` | **4.52** | ≥4.5 | 次级面上的辅助小字 |
| `#374151` / `#F7F7F8` | **9.63** | ≥4.5 | 次级面上的正文 |
| `#111827` / `#F7F7F8` | **16.57** | ≥4.5 | 次级面上的标题、量化带数字 |
| `#2563EB` / `#FFFFFF` | **5.17** | ≥4.5 | 功能蓝（选中文字、链接） |
| `#1D4ED8` / `#FFFFFF` | **6.70** | ≥4.5 | 蓝字 hover |
| `#FFFFFF` / `#111827` | **17.74** | ≥4.5 | 主按钮白字、聊天气泡 |
| `#E5E7EB` / `#111827` | **14.33** | ≥4.5 | 近黑面上的小字 |
| `#FFFFFF` / `#2563EB` | **5.17** | ≥4.5 | 未读徽标白字 |
| `#374151` / `#DBDEE2` | **7.64** | ≥4.5 | SK7 头图上的小字（取渐变最深处，统一用正文色） |
| `#878E96` / `#FFFFFF` | **3.31** | ≥3（1.4.11） | 输入框 / 开关轨道边界、搜索框 |
| `#2563EB` / `#FFFFFF` | **5.17** | ≥3（1.4.11） | focus ring |

**反例（已避开，写在这里防止有人改回去）**

| 组合 | 比值 | 结论 |
|---|---|---|
| `#EAEAEA` / `#FFFFFF` | 1.20 | 发丝线只能做装饰，**不能**当输入框边界 |
| `#DFE1E4` / `#FFFFFF` | 1.31 | chip 边同理；chip 的可辨识性由 4.83:1 的文字承担 |
| `#9CA3AF` / `#FFFFFF` | 2.54 | 只许装饰/禁用，**不要**用它写需要读的小字（旧口径把它当辅助色是错的） |
| `#C7CBD1` / `#FFFFFF` | 1.63 | 占位符专用（占位文本不承载信息） |
| `#6B7280` / `#DBDEE2` | 3.58 | 头图上的小字因此改用 `#374151`（7.64） |
| `#2563EB` / `#111827` | 3.43 | 蓝压在近黑面上既不够正文也不够焦点环 → 深色面上的焦点环改**白**（`sk8` 的迷你工具栏即此例） |

## 五、可访问性证据（写法层面可判，不是声明）

- **焦点可见**：`a / button / input / textarea / select / summary / [tabindex] / [role="switch"]` 全部 `:focus-visible` → `outline: 2px solid #2563EB` + `offset: 2px`（白上 5.17:1，过 1.4.11 的 3:1）；近黑面上的控件改白描边（`style.css` 的 `.on-ink / .on-dark`，以及 `sk8-canvas.html` 里 `.e-blockToolbar button:focus-visible`）。
- **语义**：`header / nav / main / article / aside / footer` 分层；SK1 有「跳到正文」skip link（目标 `tabindex="-1"`）、目录 `nav[aria-label="系列目录"]`；SK2 筛选结果用 `aria-current`；SK3 表格 `th scope="col|row"` + 移动端 `data-label` 降级为行卡；SK4 列表 `ul[aria-label="会话列表"]`、当前项 `aria-current="true"`、两个可滚 pane 都是 `role="region"` + `tabindex="0"` + 中文 `aria-label`；SK5 chip `aria-pressed`、步骤 `ol` + `aria-current="step"`；SK6 `role="tablist"/"tab"/"tabpanel"`；SK7 进度 `role="progressbar"` + `aria-label="已读到第 3 章，共 8 章"`；SK8 工具轨 `role="toolbar"` + 每个按钮 `aria-label`。
- **只有一份 main**：两个设备框是同一张页面的两种形态，各带 `<main>` 就会变成一份文档两个 main。所以 `.frame` 用 `role="group"` + `aria-label="桌面原型，1440 宽"`，框内主体是 `<div>`，整份文档只有最外层一个 `<main>`（真实页面里那个位置当然是 `main`）。
- **图标与装饰**：所有图标是 `aria-hidden="true"` 的内联 SVG；纯图形按钮靠 `aria-label` 命名（如「通知（3 条未读）」）。封面/头图/图占位都是 CSS 渐变（中性灰），标 `role="img"` + `aria-label` 或 `aria-hidden`，全目录**没有一张 `<img>`**。
- **h1 归属**（对齐 A 文档 §7）：**每个 frame 内恰有 1 个 `<h1>`**（一个文件里的两个 frame 是同一页的两种形态，所以同文件出现 2 次）。SK1 正文标题、SK2/SK5 页内大标题、SK6 线页头标题、SK7 章节标题、SK8 画布稿件标题各 1 个；SK3 首块是量化带、视觉上没有标题位 → 沿用 `<h1 class="sr-only">创作中心</h1>` 模板；SK4 移动端一次只显示线程、也没有标题位 → `<h1 class="sr-only">私信</h1>`；SK4 桌面端列表列标题 `私信` 为 `h1`，**详情 pane 里的会话标题是 `h2`**（一个路由只有一个 h1）。

## 六、与上一版的实际差异

1. **配色整体重涂**：深蓝/米白/金 → 纯白画布 + `#EAEAEA` 发丝线 + 近黑主按钮。金色全部清掉；原来靠「金」承担的状态（当前项、未读、进度、选中块）改为**近黑填充**或**功能蓝**，蓝色每屏 ≤2 处。`cover` / SK7 头图的中性灰渐变取代了原来的深蓝渐变。
2. **字体**：衬线展示字体（`--serif`）退场，标题/正文/阅读全用一套系统无衬线栈；页面标题字重 700 → **600**（hero 仍 700）。
3. **间距与圆角**：内容宽从 1328 收到 **1280**（`--pad: 56px → 80px`）；卡片圆角 12 → **16**，输入框统一 **12**，标签/小按钮 **8**。
4. **删掉后端不存在的占位数据**（Lead 点名 + 我自己扫了一遍）：
   - SK1：`约 4,800 字`（正文 meta）、`约 3,600 字`、`阅读约 9 分钟`、`阅读约 6 分钟` → 换成真实字段（发布时间）或直接删除；
   - SK3：`1,270 字` ×2（「继续创作」卡）→ 只留「最近更新于 3 小时前」（`updatedAt`）；
   - SK7：`约 4,800 字 · 18 分钟`、`约 4,800 字` → 改成「**共 8 章**」（`chapterCount` 是真实字段）；
   - SK8：`草稿 · 1,270 字`、`预计阅读 5 分钟`、版本列表里的 `1,270 / 1,204 / 1,188 字` → 改为「草稿 · 已自动保存」+ 自动保存时间戳。
   依据：后端没有正文字数/阅读时长字段，`bookshelf-page.test.tsx:80` 甚至**反面断言**过「阅读时长」不该出现。
5. **文件重命名 + `data-sk`**：`archetype-N.html` → `skN-*.html`，`<body data-sk="SKn">`，两个 `.frame` 也各带 `data-sk`；
   每屏页首新增「**真实页面**（A §3，共 2 例以上）」区块，列出带路径的产品页面（`xingyu-web/src/features/...`），路径已逐个用 `Get-ChildItem` 核对存在。
6. **index.html 重写**：从「8 张并排小卡」改成一条**发丝线目录**（每行：SK 名 / 真实页面 / 首屏第一块 / 一句话差异），并按 SK1–SK8 顺序；顶部换成白底色板（8 个 token 带实测比值）。
7. **保留**：8 屏结构、每屏 2 个 frame（1440 + 390）、零依赖零脚本、每屏至少一处非等高节奏、桌面框 `zoom: .58`。

## 七、我实际跑过的验证（可复现）

1. **结构校验**（Node 脚本遍历 9 个 HTML）：标签配对、`id` 不重复、`aria-labelledby/describedby/controls` 与 `label[for]`、`href="#…"` 目标全部存在（0 处悬空）；每个 `sk*.html` 恰好 2 个 `.frame`（1440/390）且带 `data-sk`；`<main>` 恰好 1 个；`index.html` 的 SK 顺序为 1..8；HTML 里用到的每个 class 都能在 `style.css` 或该文件自己的 `<style>` 里找到（0 处拼写悬空）；引用的 `xingyu-web/src/...` 路径逐个存在。
2. **外部依赖检索**：9 个 HTML + 1 个 CSS 上检索 `http://`、`https://`、`<script`、`@import`、`src="`、`<img` → **命中 0 处**；除 `style.css` 没有第二个 `<link>`。
3. **旧色清理**：`--gold` / `--gold-soft` / `--gold-strong` / `--serif` / `--cream` / `#1a2138` / `#f9f7f2` / `#e8cfa1` / `#b9b8b0` / `#cfcfca` / `rgba(245,158,11…)` 在 9 个 HTML + CSS 里 **命中 0 处**；`深蓝` 只出现在「不再使用它」的说明句里。
4. **渲染**：Chrome headless（`--headless --screenshot`，窗口 1800×2600 与 2× 倍率）逐屏出图，58% 与 1:1 两档都看过；据此修掉一处真实缺陷 —— 页首「真实页面」灰块与下面那段说明贴死（补 `.gsub + .gsub { margin-top: 16px }`）。
5. **蓝色预算**：脚本按文件统计 `var(--accent)` 次数，8 屏分别为 1 / 0 / 1 / 1 / 1 / 1 / 1 / 2，**全部 ≤2**；其中 SK7 的第 2 处在共享的 `.meter`（进度条填充，定义在 `style.css`），因此 SK7 实际可见蓝点为「目录当前项 + 进度条」两处。

## 八、文件

```
docs/design-system/skeletons/
  index.html        8 类总览（SK 名 / 真实页面 / 首屏第一块 / 一句话差异）
  sk1-reading.html  SK1 阅读栏
  sk2-gallery.html  SK2 画廊
  sk3-console.html  SK3 控制台
  sk4-inbox.html    SK4 收件箱
  sk5-flow.html     SK5 流程
  sk6-feed.html     SK6 信息流
  sk7-reader.html   SK7 阅读器
  sk8-canvas.html   SK8 创作台
  style.css         共享 token 与基础组件（本目录唯一 CSS 入口）
  README.md         本文件
```

约束遵守情况：只写本目录；未改 `xingyu-web/**`，未改 `.team/design/*.md`；无 React/Vue/Tailwind CDN；无字体下载；无 `npm install`；无脚本。
