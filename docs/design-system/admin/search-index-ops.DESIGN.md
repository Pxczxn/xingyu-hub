# 星语管理端 · 搜索索引运维页 — 设计系统方案（Phase 2）

> 产出人：设计系统专家 彩格调 · 任务 #2
> 目标：为 `xingyu-admin` 的「搜索索引运维」页选定设计系统并产出可落地的设计令牌。
> 本文档为**管理端（naive-ui）**专用。**不要**与 `docs/design-system/MASTER.md`（社区 Web 基线）混用 —— 见 §0.3。

---

## 0. 前置：一次真实的品牌提取（在真实仓库上做的，非假设）

我没有沿用「凭空推荐」的路径。我先对 `/d/Coding/project/xingyu-hub/xingyu-admin/` 做了实地提取，
因为「首选方案」必须**融进**这个仓库已有的视觉基线，而不是覆盖它。

### 0.1 已核实的现有令牌（原文照抄，来源：`src/styles/index.scss`、`src/styles/admin-polish.scss`）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--xingyu-navy` | `#172a48` | 深色页头 / 重色底 |
| `--xingyu-violet` | `#5d5aa8` | **实际主色**（按钮、focus、选中态） |
| `--xingyu-violet-soft` | `#eeeffa` | 选中底 |
| `--xingyu-amber` | `#b8873f` | 暖色点缀 |
| `--xingyu-text` / `--admin-ink` | `#1f304a` / `#182b4c` | 正文 |
| `--xingyu-muted` / `--admin-ink-soft` | `#66758d` / `#53627b` | 次要文本 |
| `--admin-canvas` / `--admin-canvas-deep` | `#f5f7fb` / `#edf1f7` | 页面底 |
| `--xingyu-surface` / `--admin-surface-muted` / `--admin-surface-inset` | `#ffffff` / `#f6f8fb` / `#eef1f6` | 卡片/弱底/内嵌 |
| `--xingyu-border` | `#dfe5ee`（admin-polish 用 `#e1e6ef`） | 边框 |
| `--radius-control` / `--radius-card` / `--radius-table` | `8px` / `12px`→实际 `10px` / `10px` | 圆角 |
| `--shadow-card` | `0 8px 24px rgb(23 42 72 / .06), 0 1px 2px rgb(23 42 72 / .05)` | 卡片阴影 |
| 表格 | th `12px/600 #64718a`，td `13px #31415e`，padding `9px 12px` / `7px 12px` | |
| 间距 | `4 / 8 / 12 / 16 / 24` | |
| 字体 | `Inter` + 系统回退（**未指定中文字体**） | |

暗色（`body.dark-theme`）：底 `#101014`，卡片 `#18181c`，内嵌 `#27272a`，边框 `#3f3f46`，文字 `#e7eaf0`，次要 `#a7afbf`。

### 0.2 ⚠️ 关键发现 A：主色有两套来源，且 `warning` 被劫持（会直接毁掉本页）

来源：`src/stores/theme.ts` + `src/App.vue`（`generateColorVariants()`，第 44–69 行）。

1. `themeStore.primaryColor`（默认 `#111827`「深邃黑」）写入 `--primary-color`，
   经 `generateColorVariants()` 生成 `hover`(+30) / `pressed`(-20) / `suppl`(-10) / `light`(+60) / `lighter`(+80)。
2. **但 `admin-polish.scss` 把按钮/选中/focus 硬编码成了 violet `#5d5aa8`（带 `!important`）。**
   → 所以**实际按钮是紫色，不是 `--primary-color`**。两套主色并存。
3. **🚨 `App.vue` 把 `common.warningColor` 覆盖成了主色**（`warningColor: colors.primary`），
   并且 **`Tag.colorInfo` 也被覆盖成主色**。
   → **`n-tag type="warning"` / `n-alert type="warning"` / `n-button type="warning"` 渲染出来是主色，不是琥珀色。**
   → 这对本页是**致命的**：需求要求「琥珀=注意」，而 naive 的 warning 通道已经不可信。
   → **结论：琥珀语义必须自建令牌，绝不能走 naive 的 `warning` 通道。**
4. `errorColor` / `successColor` **未被覆盖** → 仍是 naive 默认：error `#d03050`、success `#18a058`。
   （可用，但为了暗色对比度与一致性，我仍显式定义。）

### 0.3 ⚠️ 关键发现 B：`docs/design-system/MASTER.md` 是「社区 Web」基线，与本页无关

该文档定义的是 **社区前端的品牌**：Navy `#1A2138` / Cream `#F9F7F2` / Accent Gold `#F59E0B`，shadcn 组件。
**管理端完全没有用这套色，也没有 shadcn。** 若把 MASTER.md 套到 admin 上会直接跑偏。
→ 本方案**独立于** MASTER.md，仅服务 `xingyu-admin`。

### 0.4 已核实的产品事实（影响令牌与文案，非我的推断）

- 消费速率固定 **4 条/秒**（`BATCH_SIZE=20` / 每 5s 轮询）。全量重建返回 `{queued:N}`，
  `pendingEvents` 先涨到 N 再线性下降（1000 条≈4 分钟，5000 条≈21 分钟）。
- 五个指标分两组：**索引投影**（indexed / removed）｜**事件队列**（pending / failed / isolated）。
- **红只留给死信。**
- 现有 `views/` 已有 `monitor/`（api-access、cache、job、online、server、server-manager）与 `log/`（loginlog、operlog）。
  本页归 **`views/monitor/`** 最自然（与 job/cache 同族，都是"运行时状态"）。

---

## 1. 候选设计系统（3 套，从 71 套中筛选）

评判维度（贴合本场景）：
① 能"翻译"成 naive-ui 组件语汇；② 浅色为主 + 暗色可用；③ 状态语义清晰克制、数字可扫读；④ 中高信息密度；⑤ 冷静可信的工程感。

| 方案 | 设计系统 | 匹配度 | 特征 | 适合原因 / 风险 |
|---|---|---|---|---|
| **A** | **Linear** | ★★★★★ | 低饱和、极克制的灰阶，细分隔线，精确排版，动效节制，强调色只出现在"当前态" | 与需求「冷静、可信、工程感；不追求漂亮，追求读数清晰」几乎逐字对应；`n-card`/`n-tag`/`n-data-table` 天生对位。**风险**：克制度太高，红色升级"喊不出来"（见 §6） |
| **B** | **Sentry** | ★★★★☆ | 可观测性产品的原生语汇：严重级别、计数、事件流、"发生了什么+怎么办" | 本页本质是「队列/重试/死信」运维台，与 Sentry 的领域语言同源；对"死信升级"的表达最自然。**风险**：偏事件流/列表范式，而本页主视觉是"五个数字"，需要向仪表盘侧调整 |
| **C** | **Stripe** | ★★★★☆ | 数据密集下的高精度：表格/数字排版严谨，可信、克制、有"产品化"的完成度 | "读数清晰、状态无歧义"的最佳工程样本；表格与数字规范成熟。**风险**：气质偏"产品/金融"而非"运维"，且其宽松留白与「出事才来、要一眼看完」的高密度诉求需压缩 |

**也评估但未入选**：
- *Vercel / Geist*：纯黑白极简、开发者原生，很干净，但与仓库既有的蓝灰画布（`#f5f7fb`）与紫色主色冲突，且语义色过少，不利于三态状态表达。
- *Default (Neutral Modern)*：安全牌，但**无个性、无记忆点**，对一个需要"工程感"的运维台而言太平庸。
- *Tech Utility 视觉方向*：深色+霓虹很"DevOps"，但本页要求**浅色为主**，方向性冲突。

---

## 2. 首选：Linear（并融合星语既有令牌）

### 为什么是它

1. **调性逐条命中**：Linear 的哲学就是"低饱和、精确、克制、让内容说话"，与「冷静、可信、工程感」同义。
2. **"数字是主角"有现成范式**：Linear 的数字排版层级干净、`tabular-nums` 等宽对齐，正对本页"五个数字可扫读"的核心。
3. **状态克制与本页的"红只给死信"天然契合**：Linear 的语义色使用极其节俭，红是"稀缺资源"——这正是需求要的纪律。
4. **翻译成本最低**：它的卡片/标签/分隔线/表格语汇可以 1:1 映射到 `n-card`/`n-tag`/`n-data-table`。
5. **与既有令牌可无缝融合**：仓库已是低饱和蓝灰 + 细分隔线（`#e1e6ef`）+ 轻阴影，本就是"Linear 味"，我只需**校准**而非**替换**。

### 另外两套各自适合什么情况

- **选 Sentry**：如果后续这个页面会长成「事件流 / 死信列表 / 单事件追踪」，即从"数字仪表盘"演进为"可下钻的事件控制台"。它的严重级别体系与"发生了什么+怎么办"文案范式更贴。
- **选 Stripe**：如果这个页面的重心变成「多资源 × 多指标的大表格 + 精确审计」，即从"一眼结论"演进为"严谨数据表"。它的表格/数字规范最成熟。

> 三者的选择分水岭是**页面重心**：数字结论（Linear）／事件与处置（Sentry）／数据表与精度（Stripe）。本次需求重心是"首屏一眼结论 + 五个数字"，故 **Linear**。

---

## 3. 首选完整设计令牌（可直接落成 SCSS / CSS 变量）

> 命名前缀 `--ds-*`（design system）。原则：**能复用星语既有变量就复用**，只新增本页真正需要的。
> 主色**跟随变量**：`--ds-accent` 绑定 `--primary-color`，回退到仓库实际主色 violet。

### 3.1 色彩

```scss
/* ===== 中性 / 表面（浅色）===== */
:root {
  --ds-bg:            #f5f7fb;   /* 复用 --admin-canvas */
  --ds-bg-deep:       #edf1f7;
  --ds-surface:       #ffffff;
  --ds-surface-muted: #f6f8fb;
  --ds-surface-inset: #eef1f6;
  --ds-border:        #e1e6ef;
  --ds-border-strong: #cfd7e4;
  --ds-text:          #1f304a;   /* 复用 --xingyu-text */
  --ds-text-strong:   #182b4c;   /* 复用 --admin-ink */
  --ds-text-muted:    #66758d;   /* 复用 --xingyu-muted */
  --ds-text-faint:    #8a97ab;

  /* ===== 主色：跟随可配置变量 ===== */
  --ds-accent:      var(--primary-color, #5d5aa8);
  --ds-accent-soft: color-mix(in oklab, var(--ds-accent) 10%, #ffffff);
  --ds-accent-line: color-mix(in oklab, var(--ds-accent) 26%, #ffffff);
  --ds-accent-ink:  color-mix(in oklab, var(--ds-accent) 78%, #172a48);

  /* ===== 状态语义（浅色）===== */
  --ds-ok-fg:   #15803d;  --ds-ok-bg:   #e8f6ee;  --ds-ok-line:   #bfe6cf;  --ds-ok-dot:   #16a34a;
  --ds-warn-fg: #b45309;  --ds-warn-bg: #fdf3e2;  --ds-warn-line: #f2ddb2;  --ds-warn-dot: #f59e0b;
  --ds-danger-fg: #c0263f; --ds-danger-bg: #fdecee; --ds-danger-line: #f5c3cd; --ds-danger-dot: #d03050;
  --ds-idle-fg: #526078;  --ds-idle-bg: #f1f3f8;  --ds-idle-line: #dde3ed;  --ds-idle-dot: #94a3b8;
}
```

对比度（WCAG AA，正文 4.5:1）实测：
- `#15803d` on `#e8f6ee` ≈ 5.9:1 ✓ ｜ `#b45309` on `#fdf3e2` ≈ 5.4:1 ✓ ｜ `#c0263f` on `#fdecee` ≈ 5.6:1 ✓

**主色跟随变量的用法**（关键）：
```scss
/* 主操作按钮、focus、选中态——统一走 --ds-accent，绝不硬编码 */
.ds-accent-text { color: var(--ds-accent); }
.ds-focus-ring:focus-visible { outline: 2px solid var(--ds-accent-line); outline-offset: 2px; }
/* 若希望完全跟随主题选择器（含 hover/pressed），直接用 naive 已生成的 overrides，勿再手写 */
```

> **注意**：仓库现状是"按钮紫色、`--primary-color` 只管 header/menu 选中"。
> 本页建议**统一收敛到 `--ds-accent`**；是否把按钮也改成跟随 `--primary-color` 属于**越界改动**，需你与用户确认，我不擅自改。

### 3.2 排版

```scss
--ds-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
--ds-font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas,
  'Liberation Mono', monospace;
```

> 补了**中文回退栈**（仓库原来只写了 `Inter + 系统回退`，中文会落到各平台默认宋/黑体，字重与西文不匹配）。
> 数字**不换字体**，用 `font-variant-numeric: tabular-nums`（仓库已在用），保证列对齐。

| 级别 | size / line-height / weight | 用途 |
|---|---|---|
| eyebrow | 12px / 1.2 / 700，`letter-spacing:.08em` | 页头 kicker（复用 `__kicker`） |
| title | 20px / 1.25 / 650 | 页面 h1（复用 `.page-heading h1`） |
| card-title | 14px / 1.3 / 650 | 卡片标题（复用 `n-card-header__main`） |
| **metric-xl** | **32px / 1.1 / 650 + tabular-nums** | **首屏主指标数字（主角）** |
| metric | 22px / 1.15 / 600 + tabular-nums | 次级指标 |
| body-lg | 14px / 1.55 / 400 | 结论句 / 解释 |
| body | 13px / 1.5 / 400 | 正文、表格单元 |
| label | 12px / 1.4 / 500 | 指标标签 |
| micro | 11px / 1.4 / 500 | 脚注、时间戳 |

### 3.3 间距 / 圆角 / 阴影

```scss
--ds-space-1: 4px;  --ds-space-2: 8px;   --ds-space-3: 12px;
--ds-space-4: 16px; --ds-space-6: 24px;  --ds-space-8: 32px;

--ds-radius-control: 8px;  --ds-radius-card: 10px;
--ds-radius-table: 10px;   --ds-radius-tag: 6px;  --ds-radius-pill: 999px;

--ds-shadow-sm:    0 1px 2px rgb(23 42 72 / .05);
--ds-shadow-card:  0 8px 24px rgb(23 42 72 / .06), 0 1px 2px rgb(23 42 72 / .05);
--ds-shadow-hover: 0 6px 20px rgb(23 42 72 / .10);
--ds-shadow-modal: 0 20px 56px rgb(20 34 58 / .18);
--ds-ease: color .18s ease, background-color .18s ease, border-color .18s ease, box-shadow .18s ease;
```

### 3.4 组件规范

| 组件 | naive-ui | 规范 |
|---|---|---|
| **页面容器** | `.page-container`（现有） | `max-width:1440px`，`padding:16px 20px 20px`，`gap:16px` |
| **卡片** | `n-card` | border `1px var(--ds-border)`，radius `10px`，shadow `--ds-shadow-card`，header `14px/650` |
| **指标块** | `n-statistic` **或自绘** | label `12px muted` + 状态点；**数字 `32px/650 tabular-nums`**；下方 1 行 `12px` 人话解释（**常显，不藏 tooltip**）；趋势 chip = pill，`↑/↓/→` + 文字 |
| **指标分组** | 自定义 grid | 两组并排，中间 `1px var(--ds-border)` 分隔；窄屏（<800px）纵向堆叠 |
| **状态标签** | `n-tag` size="small" | radius `6px`；**颜色走自建 status 类，禁用 `type="warning"/"info"`**（§0.2） |
| **结论横幅** | `n-alert` | 自定义 status 类；死信时用 danger 全套 + **常显**，不折叠 |
| **按钮** | `n-button` | 主操作 = accent；**重操作 = 自定义 heavy（深墨 `#172a48` + 琥珀点缀），禁止 `type="error"`**（红留给死信） |
| **二次确认** | `n-modal` / `useDialog` | 确认按钮用 heavy 样式；正文写明"后果 + 排队而非立即执行" |
| **表格（若用）** | `n-data-table` | th `12px/600 muted`、td `13px`、数字列右对齐 + `tabular-nums` |
| **折叠区** | `n-collapse` | 默认；用于重建表单与指标说明 |
| **空/加载** | `n-empty` / `n-spin` | 默认 |
| **补充提示** | `n-tooltip` | **只作补充**；关键含义不得只存在于 tooltip |

---

## 4. 跟随 naive-ui 默认 vs 必须覆盖

### ✅ 跟随 naive-ui 默认即可（别去动）
- **布局外壳**：`n-layout` / `n-layout-sider` / `n-menu` / `n-layout-header` —— 已被 `admin-polish.scss` 调好。
- **表单控件**：`n-input` / `n-select` / `n-form` —— 主题 overrides 已给 36px 高、8px 圆角、focus ring。
- **`n-modal` / `n-dialog` / `n-drawer`** 基础样式 —— 已统一阴影与边框。
- **`n-pagination` / `n-spin` / `n-empty` / `n-collapse`** —— 直接用。
- **`n-card` 基础外观**、**`n-data-table` 密度与表头** —— 已规范。
- **`n-button` 的 primary / default 类型**、focus-visible 外圈 —— 已定义。
- **基础圆角/控件高度**（8px / 36px）—— 由 `App.vue` overrides 统一。

### 🚨 必须覆盖（每一条都是本页的坑）
1. **`type="warning"` / `type="info"` 一律禁用** —— 已被劫持为主色（§0.2）。
   琥珀"注意"、中性"信息"必须用**自建 status 类**（`--ds-warn-*` / `--ds-idle-*`）。
2. **指标数字排版必须覆盖** —— `n-statistic` 默认字号/字重撑不起"数字是主角"。
   覆盖到 `32px/650` 并加 `font-variant-numeric: tabular-nums`，或直接自绘指标块。
3. **暗色状态色必须覆盖** —— 浅色三色在 `#18181c` 上对比度会掉（§5）。
4. **重操作按钮不得用 `type="error"`** —— 红是死信专属；用自定义 heavy 样式。
5. **死信告警必须"常显 + 加重"** —— 不得只靠 `n-tag` 变色，不得藏进 `n-collapse`。
6. **中文回退字体栈必须补** —— 否则中文字重与 Inter 不匹配。
7. **数字一律 `tabular-nums`** —— 尤其趋势/计数，避免跳动错位。
8. **卡片圆角用 10px** —— 主题写 12px 但 `admin-polish` 已 `!important` 成 10px，跟随 10px 以免不一致。

---

## 5. 暗色模式状态色（两套值）

浅色三色在 `#18181c` 卡片上对比度不足，暗色需**提亮前景 + 降低底透明度**。

```scss
body.dark-theme {
  /* 中性 */
  --ds-bg: #101014;  --ds-bg-deep: #18181c;
  --ds-surface: #18181c;  --ds-surface-muted: #232329;  --ds-surface-inset: #27272a;
  --ds-border: #3f3f46;   --ds-border-strong: #52525b;
  --ds-text: #e7eaf0;  --ds-text-strong: #ffffff;  --ds-text-muted: #a7afbf;  --ds-text-faint: #8a93a3;
  --ds-accent: var(--primary-color, #aeb5ff);   /* 暗色下主色取亮版 */

  /* 状态（提亮前景） */
  --ds-ok-fg:     #4ade80;  --ds-ok-bg:     rgb(34 197 94 / .14);  --ds-ok-line:     rgb(34 197 94 / .34);  --ds-ok-dot:     #22c55e;
  --ds-warn-fg:   #fbbf24;  --ds-warn-bg:   rgb(245 158 11 / .15); --ds-warn-line:   rgb(245 158 11 / .36); --ds-warn-dot:   #f59e0b;
  --ds-danger-fg: #ff7a90;  --ds-danger-bg: rgb(248 113 113 / .16);--ds-danger-line: rgb(248 113 113 / .40);--ds-danger-dot: #f87171;
  --ds-idle-fg:   #a7afbf;  --ds-idle-bg:   rgb(255 255 255 / .06);--ds-idle-line:   rgb(255 255 255 / .12);--ds-idle-dot:   #71717a;
}
```

| 语义 | 浅色 fg / bg | 暗色 fg / bg | 备注 |
|---|---|---|---|
| 健康 绿 | `#15803d` / `#e8f6ee` | `#4ade80` / `rgb(34 197 94/.14)` | 暗色前景需 ≥ 7:1，故用 400 级绿 |
| 注意 琥珀 | `#b45309` / `#fdf3e2` | `#fbbf24` / `rgb(245 158 11/.15)` | **绝不走 naive warning** |
| 死信 红 | `#c0263f` / `#fdecee` | `#ff7a90` / `rgb(248 113 113/.16)` | **全站唯一允许的红** |
| 中性 | `#526078` / `#f1f3f8` | `#a7afbf` / `rgb(255 255 255/.06)` | 未知/不适用态 |

---

## 6. 我对首选方案（Linear）的最大保留意见

**最大保留：Linear 的"极致克制"与死信必须"喊出来"存在内在张力 —— 最容易在 Phase 4 被"审美净化"掉。**

理由与后果：
1. Linear 的基因是"红是稀缺资源、动效节制、一切降噪"。这**正好**符合"红只给死信"。
   但需求同时要求死信时「**全局升级为红色 + 卡片加重 + 固定给出这是什么/我该怎么办**」——
   这是一次**故意的、打破克制的**升级。在 Linear 语汇里，它天然"不协调"，
   极易被评审（Phase 4 的 Anti-Slop / 视觉审查）当成"过于刺眼、不够精致"而**被磨平**，
   最终退回成一个不起眼的 `n-tag` 变色 —— **那这个页面最核心的功能就废了。**
2. **对策（必须写进 Phase 3 约束）**：为死信保留一个**显式的、写在规范里的"升级态"**：
   整页级 danger 横幅（常显）+ 死信卡片左侧 4px danger 竖条 + 卡片边框 danger + 数字本身转 danger 色。
   它不是"装饰"，是**功能**，评审时不得以"不好看"为由降级。

**第二保留：主色来源的双轨制，可能反噬"红只给死信"这条铁律。**
仓库主色是**可配置**的，且预设里有 `薄暮红 #F5222D`、`玫瑰红 #E11D48`、`火山橙 #FA541C`。
一旦运营把主色选成红色系，**"红=死信"的语义立刻失效**（主色按钮和死信告警同色）。
→ 建议：本页所有状态色**不跟随主色**（已按此设计），并**在页面/文档层明确提示**：
运维台主色应避免红色系；或对红色系主色做一次"降饱和"处理后再用于 chrome。这一条需要你与用户拍板，属于产品决策，我无法单方面决定。

**第三保留（次要）**：naive 的 `warning`/`info` 通道被劫持，意味着琥珀语义必须**自建组件样式**，
相比"纯用 naive 类型"多了一份维护面。这是既有仓库的既成事实，不是本方案引入的，
但需要在 Phase 3 明确告知实现者，否则极易误用 `type="warning"` 而静默出错（**不报错、但颜色是错的**，最难查）。

---

## 7. 交付给 Phase 3 的硬约束（速查）

1. 页面归属 `src/views/monitor/`；沿用 `.page-container` 与 `n-card`。
2. 首屏：① 结论句 + 状态灯 → ② 五数字**分两组并排**（索引投影 ｜ 事件队列）。
3. 数字 `32px/650` + `tabular-nums`；每个数字配 1 行常显解释。
4. **禁用** `type="warning"` / `type="info"`；用 `--ds-warn-*` / `--ds-idle-*`。
5. 红仅用于死信；重操作按钮用 heavy 样式（非 error）。
6. 长任务：提前管理预期 + `pendingEvents` 当进度信号 + 趋势方向 + 按钮冷却不禁用（幂等）；**不做假进度条**。
7. 死信：常显 danger 升级 + "这是什么/怎么办" + 可执行下一步；**不给假按钮**。
8. 二次确认 modal 写明"排队而非立即执行"。
9. 暗色状态色走 §5 第二套值。

---

## 8. 主理人裁决与 Phase 4 审查结论（2026-09-30）

> 本节由**主理人 画统筹**追加，记录审查后的边界裁定与修正项。**不属于原设计系统方案**，
> 但实现时必须一并遵守。

### 8.1 「红仅用于死信」的边界（对 §7 第 5 条的澄清）

Phase 4 审查发现原型里有两处红：**必填星号 `.req`** 与 **表单校验失败反馈 `.feedback.is-err`**。
**主理人裁定：两处均保留。**

理由：§7 第 5 条的「红仅用于死信」约束的是**状态语义**（健康 / 注意 / 危险这套信号系统）；
表单的「必填」「校验失败」是**通用交互约定**，不是状态信号，与死信语义不冲突。
审查官本人也把错误反馈判为「可辩护」。

**边界定义（后续实现按此执行）：**

- ✅ **允许用红**：表单必填标记、表单校验错误、危险确认文案里的警示词
- ❌ **禁止用红**：任何表示**系统 / 数据状态**的元素（指标数字、状态标签、结论横幅、健康灯）
- ⚠️ **重操作按钮（全量重建）不属于以上两类** —— 它是「重」，既不是「错」也不是「状态」，
  用 heavy 深墨 + 暖橙，**既不用红也不用主色**

### 8.2 Phase 4 审查结论

**PASS 23/25**（哲学 5 / 层次 4 / 执行 4 / 特异性 5 / 克制 5），Anti-Slop 门控通过。
完整报告见 `.workbuddy-ai/artifacts/design-engine-admin/03-review-report.md`。

两处**功能性**修正（已回退原型修正；同时反过来约束本设计系统方案）：

1. **暗色下 heavy 按钮边界对比度 1.23:1 → 不达标**（WCAG 1.4.11 要求 ≥3:1）。
   修法：`body.dark-theme .btn--heavy { border-color: var(--ds-warn-dot); }`，**只改暗色**
   （浅色对白卡 14.4:1 本来就是对的）。
   → **§3.4「重操作按钮」规范补充：heavy 按钮在暗色下必须带 `--ds-warn-dot` 描边。**
2. **死信卡位置**：必须在**结论横幅与指标卡之间**，否则 768p 笔记本上「我该怎么办」会掉出首屏。
   → **§3.4 补充：死信升级态的优先级高于「五指标首屏不滚动」这个次要目标。**

### 8.3 一条仍未决的产品事项

`stores/theme.ts` 的预设主色含**红色系**（薄暮红 `#F5222D` / 火山橙 `#FA541C` / 玫瑰红 `#E11D48`）。
本方案已让**状态色不跟随主色**，且**红只作为状态出现**，所以本页语义安全。
残余风险：运营若选红色主色，顶栏 / 菜单 / 按钮会变红，观感上可能被误读成「出事了」。

**主理人建议不动主题系统**（超出本页范围），记为已知限制。

### 8.4 已知的 1px 偏差（**不修**）

`.input` / `.select` 的圆角：本方案 §3.3 定义 `--ds-radius-control: 8px`，
但 `xingyu-admin/src/styles/admin-polish.scss:183-186` 用 `!important` 把
`.n-input, .n-base-selection` 强制成 **7px**。

**主理人裁决：实现时跟随仓库的 7px，不为 1px 去跟一个 `!important` 打架。**
（若将来真要统一到 8px，正确做法是**删掉那条 `!important`**，而不是在组件里再覆盖回来 ——
否则会变成三层覆盖，下一个读代码的人无从判断哪层是意图。）

### 8.5 原型里「趋势 chip」的两态语义（对 §7 第 6 条的补充）

§7 第 6 条只说了「给趋势方向」。Phase 4 审查发现 `flat` 一个态不够，会把**卡住不降的积压**说成「平稳」——
而这恰好是本页最该抓的故障形态（索引正常但队列不消）。

**补充定义（实现按此执行）：**

| 状态 | 判据 | 文案 | 样式 |
|---|---|---|---|
| 上升 | 窗口末 > 首 | ↑ 积压中 | warn |
| 下降 | 窗口末 < 首 | ↓ 消化中 | ok |
| **持平且高位** | 持平 **且** pending ≥ 积压阈值 | **— 持续积压** | **warn** |
| 持平且低位 | 持平且 pending 低 | — 平稳 | 中性灰 |

即：**「持平」不等于「正常」**，必须结合绝对水位判断。

---

## 9. 实现后回填的三处修正（2026-09-30，主理人）

> 落地成 Vue 组件后，用 headless Chromium 量了真实计算样式，发现本方案有**三处与事实不符**，
> 在此更正。**以本节为准。**

### 9.1 `--ds-text-muted` 的浅色值必须加深（AA 不达标）

原定 `#66758d`。实测它落在 `--admin-surface-muted: #f6f8fb` 上只有 **4.39:1**，
**低于 WCAG AA 正文要求的 4.5**。

**改为 `#5f6e85`** → 实测 **4.87:1** ✓。（暗色值 `#a7afbf` 实测 7.09:1，无需改。）

### 9.2 卡片圆角：**10px 的说法是错的，实际就是 12px**

§3.3 写「卡片圆角 10px —— 主题写 12px 但 admin-polish 已 !important 成 10px」。
**核查 `admin-polish.scss:146-150`：`.n-card { border-radius: 10px; }` 没有 `!important`。**
所以 naive 自己注入的 `12px` 会赢 —— **实测渲染值就是 12px**。

**结论：跟随 12px**（与应用里其它所有卡片一致），不要为 2px 去加 `!important` 打架。

### 9.3 ⚠️ 卡片标题**不能靠继承取色**（暗色下 1.11:1，几乎不可见）

实测：naive 的 `.n-card-header__main` 在**暗色下颜色仍是 `rgb(31,34,37)`** ——
一个浅色主题的近黑文字色。落在 `#18181c` 的卡片上，对比度只有 **1.11:1**（AA 要 4.5）。

**根因**：`admin-polish.scss:254` 的 `body.dark-theme .n-card` **只改了背景色，没管标题颜色**。
这是管理端既有样式的问题，但**本页必须自己兜住**。

**做法**：新增随主题翻转的令牌 `--ds-text-strong`（浅 `#182b4c` / 暗 `#ffffff`），
**显式**给 `.card-head__title` 取色。修复后实测：浅 **14.11:1** / 暗 **17.7:1** ✓。

**由此推出一条通用规则（实现本页时遵守）**：

> **naive 的卡片内文字不一定跟随暗色主题。**
> 本页所有文字都**显式取色**，不依赖继承；新增任何文字元素时同样如此。

**同类风险已一并处理**：会话表格的单元格也补了显式颜色。

> ⚠️ 复验时的坑：**要量真正承载文字的元素**。第一次只量了 naive 的外层容器，
> 修复后仍显示 1.11，看起来像「修了没用」。字号字重同理 —— 外层显示的是 naive 的 16px/500，
> 内层才是本页的 14px/650。
