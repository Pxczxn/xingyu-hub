# 星语社区 Phase 2.2 页面级架构设计方案 v1.0

> **文档性质**：设计规范 + 开发指南  
> **版本日期**：2026-11-12  
> **状态**：待实施  
> **实施者**：开发者  
> **设计者**：总设计师  
> **前置依赖**：Phase 2.1 表面架构已完成  
> **关联文档**：《星语社区-Phase2表面架构设计方案-v1.0.md》

---

## 一、什么是"页面级架构"

### 1.1 定义

**页面级架构（Page-Level Architecture）** = 每个独立页面的内容结构和交互模式，包括：

- **首页信息流**
- **发现页内容展示**
- **星系页卡片布局**
- **文章阅读页**
- **个人主页**
- **空状态/加载态**

### 1.2 与表面架构的区别

| 层级 | 范围 | Phase 2.1 已完成 | Phase 2.2 待优化 |
|------|------|-----------------|-----------------|
| **表面架构** | 全站通用 | Header、Tab、Button、Card | - |
| **页面级架构** | 单页面内容 | - | 信息流、筛选器、卡片排版 |

---

## 二、设计目标

### 2.1 核心问题

**从用户截图和验收过程发现的页面级问题**：

#### 首页
1. ⚠️ Hero 区占用空间过大（欢迎回来 + 星空素材）
2. ⚠️ 信息流卡片排版需要优化
3. ⚠️ 右栏组件的视觉层级
4. ⚠️ 空状态设计（关注 Tab 为空）

#### 发现页
5. ⚠️ PageHero 占用空间（每次进入都要看一遍）
6. ⚠️ 左侧筛选器的展开/收起
7. ⚠️ 内容列表的卡片样式（推荐/文章 Tab）
8. ⚠️ 话题广场的双列布局（热门话题 + 最近活跃）

#### 星系页
9. ⚠️ 官方星系 vs 探索星系的视觉区分
10. ⚠️ 星系卡片的信息层级

#### 通用
11. ⚠️ 空状态的图标和文案
12. ⚠️ 加载态的骨架屏

### 2.2 设计原则

1. **内容优先**：减少装饰，让核心内容占据主要视觉空间
2. **快速扫描**：信息层级清晰，用户能快速找到想要的内容
3. **适度留白**：不拥挤，但也不空旷
4. **一致性**：同类内容的排版保持一致

---

## 三、首页优化

### 3.1 Hero 区优化

#### 当前问题
- Hero 区高度较高（欢迎回来 + 副标题 + 星空素材）
- 登录用户每次进首页都要看一遍，但信息价值不高
- 占据首屏大量空间，内容被挤到下方

#### 设计方案

**方案A：压缩 Hero（推荐）**
```tsx
{/* 登录用户：只显示一行问候 + 公告（如果有） */}
<div className="flex items-center justify-between py-4">
  <h1 className="text-xl font-semibold">
    欢迎回来，{user?.displayName || user?.username} ✦
  </h1>
  {hasAnnouncement && (
    <Link to="/announcements" className="text-sm text-accent hover:underline">
      查看公告 ›
    </Link>
  )}
</div>

{/* 访客：保留完整 Hero */}
{!isAuthenticated && (
  <EnhancedHero />
)}
```

**高度对比**：
- 当前（登录）：约 280px（Hero + 星空）
- 优化后（登录）：约 64px（一行）
- 访客保持不变

**理由**：
- 登录用户每天都看首页，不需要每次都展示欢迎信息
- 把空间留给真正的内容（信息流）
- 访客需要被吸引，保留完整 Hero

---

### 3.2 信息流卡片优化

#### 当前问题
- 卡片内容排版层级不够清晰
- 标题、摘要、元信息的视觉权重需要调整
- 点赞/收藏按钮的位置和样式

#### 设计方案

**信息流卡片结构**：
```tsx
<article className="group cursor-pointer rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md">
  {/* 头部：作者信息 */}
  <header className="flex items-center gap-3 mb-3">
    <Avatar className="h-10 w-10" />
    <div className="flex-1 min-w-0">
      <Link to={`/users/${author.username}`} className="font-semibold hover:underline">
        {author.displayName}
      </Link>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <time dateTime={publishedAt}>{timeAgo}</time>
        <span>·</span>
        <span>{contentType}</span>
      </div>
    </div>
    {/* 关注按钮（如果未关注） */}
    {!isFollowing && (
      <Button variant="outline" size="sm">关注</Button>
    )}
  </header>

  {/* 主体：标题 + 摘要 */}
  <Link to={contentUrl} className="block">
    <h2 className="mb-2 text-lg font-semibold leading-tight group-hover:text-accent">
      {title}
    </h2>
    {summary && (
      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
        {summary}
      </p>
    )}
    {/* 标签 */}
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs">
            #{tag}
          </Badge>
        ))}
      </div>
    )}
  </Link>

  {/* 底部：互动数据 */}
  <footer className="flex items-center gap-4 pt-3 border-t">
    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <Heart className="h-4 w-4" />
      <span>{likeCount}</span>
    </button>
    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <MessageSquare className="h-4 w-4" />
      <span>{commentCount}</span>
    </button>
    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <Bookmark className="h-4 w-4" />
    </button>
  </footer>
</article>
```

**关键改动**：
1. 头像从 8×8（32px）改为 10×10（40px）
2. 标题从 base（16px）改为 lg（18px）
3. 摘要使用 `line-clamp-2` 固定两行
4. 互动按钮改为图标+数字，更紧凑
5. 增加 `group-hover` 交互反馈

**间距规范**：
- 卡片内边距：`p-5`（20px）
- 头部下边距：`mb-3`（12px）
- 标题下边距：`mb-2`（8px）
- 摘要下边距：`mb-3`（12px）
- 底部上边距：`pt-3`（12px）+ `border-t`

---

### 3.3 右栏组件优化

#### 当前问题
- 右栏组件（热门话题、推荐创作者、社区活动）的视觉层级不够清晰
- 标题大小、间距需要统一

#### 设计方案

**右栏区块统一结构**：
```tsx
<aside className="space-y-6">
  {/* 热门话题 */}
  <section>
    <header className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">#️⃣ 热门话题</h2>
      <Link to="/topics" className="text-sm text-accent hover:underline">
        查看全部 →
      </Link>
    </header>
    <div className="space-y-2">
      {topics.map(topic => (
        <Link
          key={topic.id}
          to={`/topics/${topic.id}`}
          className="flex items-center justify-between rounded-lg p-3 hover:bg-surface-sunken"
        >
          <span className="font-medium">{topic.name}</span>
          <span className="text-sm text-muted-foreground">{topic.articleCount} 篇</span>
        </Link>
      ))}
    </div>
  </section>

  {/* 推荐创作者 */}
  <section>
    <header className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">👥 推荐创作者</h2>
      <Link to="/discover?tab=creators" className="text-sm text-accent hover:underline">
        查看全部 →
      </Link>
    </header>
    <div className="space-y-3">
      {creators.map(creator => (
        <div key={creator.id} className="flex items-center gap-3">
          <Avatar className="h-10 w-10" src={creator.avatar} />
          <div className="flex-1 min-w-0">
            <Link to={`/users/${creator.username}`} className="font-semibold hover:underline">
              {creator.displayName}
            </Link>
            <p className="text-sm text-muted-foreground truncate">{creator.bio}</p>
          </div>
          <Button variant="outline" size="sm">关注</Button>
        </div>
      ))}
    </div>
  </section>

  {/* 社区活动 */}
  <section>
    <header className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">📅 社区活动</h2>
      <Link to="/events" className="text-sm text-accent hover:underline">
        查看全部 →
      </Link>
    </header>
    <div className="space-y-3">
      {events.map(event => (
        <Link
          key={event.id}
          to={`/events/${event.id}`}
          className="block rounded-lg border p-3 hover:shadow-md"
        >
          <h3 className="font-semibold">{event.title}</h3>
          <p className="text-sm text-muted-foreground">{event.startDate}</p>
        </Link>
      ))}
    </div>
  </section>
</aside>
```

**统一规范**：
- 区块间距：`space-y-6`（24px）
- 标题：`text-base font-semibold`（16px）
- 标题下边距：`mb-4`（16px）
- "查看全部"链接：`text-sm text-accent`
- 内部项间距：`space-y-2` 或 `space-y-3`

---

### 3.4 空状态优化

#### 当前问题
- "还没有关注动态"空状态图标过大
- 按钮排版需要调整

#### 设计方案

**空状态统一结构**：
```tsx
<div className="flex flex-col items-center justify-center py-16">
  {/* 图标 */}
  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken">
    <Users className="h-8 w-8 text-muted-foreground" />
  </div>
  
  {/* 标题 */}
  <h3 className="mb-2 text-lg font-semibold">还没有关注动态</h3>
  
  {/* 说明 */}
  <p className="mb-6 text-center text-sm text-muted-foreground">
    关注创作者后，他们的最新内容会出现在这里。
  </p>
  
  {/* 操作按钮 */}
  <div className="flex gap-3">
    <Button variant="accent" asChild>
      <Link to="/discover?tab=creators">
        <Users className="h-4 w-4" />
        探索创作者
      </Link>
    </Button>
    <Button variant="outline" asChild>
      <Link to="/discover">浏览推荐内容</Link>
    </Button>
  </div>
</div>
```

**尺寸规范**：
- 图标容器：`h-16 w-16`（64px）
- 图标：`h-8 w-8`（32px）
- 标题：`text-lg`（18px）
- 说明：`text-sm`（14px）
- 按钮间距：`gap-3`（12px）

---

## 四、发现页优化

### 4.1 PageHero 优化

#### 当前问题
- PageHero 高度较高（约 200px）
- 每次进入发现页都要看一遍
- 占据首屏空间

#### 设计方案

**方案A：保留但压缩（推荐）**
```tsx
<BleedBand tone="card" className="py-8">
  <div className="flex items-center justify-between">
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
        DISCOVER · 阅读发现
      </div>
      <h1 className="text-2xl font-bold">发现</h1>
    </div>
    {/* 右侧装饰图标（可选） */}
    <div className="hidden md:block">
      <Compass className="h-12 w-12 text-accent/20" />
    </div>
  </div>
</BleedBand>
```

**高度对比**：
- 当前：约 200px
- 优化后：约 100px（py-8 = 64px + 内容高度）

**方案B：移除（激进）**
- 直接显示 Tab，不要 PageHero
- 把页面说明移到浏览器标题和 meta 描述

**建议**：方案A（保留但压缩），保持品牌感

---

### 4.2 筛选器优化

#### 当前问题
- 左侧筛选器占用固定宽度（244px）
- 移动端如何展示筛选器

#### 设计方案

**桌面端**（≥1024px）：
```tsx
<aside className="sticky top-[calc(var(--shell-header-height)+1rem)] w-60 shrink-0 self-start">
  {/* 排序 */}
  <section className="mb-6">
    <h3 className="mb-3 text-sm font-semibold">排序</h3>
    <div className="space-y-2">
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        最新
      </button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        精选
      </button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        兴趣
      </button>
    </div>
  </section>

  {/* 话题筛选 */}
  <section className="mb-6">
    <h3 className="mb-3 text-sm font-semibold">按话题筛选</h3>
    <input
      type="text"
      placeholder="搜索话题..."
      className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
    />
    <div className="max-h-60 space-y-1 overflow-y-auto">
      {topics.map(topic => (
        <button
          key={topic.id}
          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken"
        >
          {topic.name}
        </button>
      ))}
    </div>
  </section>

  {/* 内容类型 */}
  <section>
    <h3 className="mb-3 text-sm font-semibold">内容类型</h3>
    <div className="space-y-2">
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        全部内容
      </button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        文章
      </button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        系列
      </button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-sunken">
        动态
      </button>
    </div>
  </section>
</aside>
```

**移动端**（<1024px）：
- 筛选器改为顶部横向滚动的 Chip 组
- 或者在 Tab 下方显示 "筛选" 按钮，点击后弹出 Sheet

---

### 4.3 内容列表优化

#### 当前问题
- 推荐 Tab 和文章 Tab 的卡片样式不够清晰
- 卡片信息层级需要调整

#### 设计方案

**列表卡片**（推荐/文章 Tab）：
```tsx
<article className="flex gap-4 rounded-2xl border bg-card p-5 hover:shadow-md">
  {/* 左侧：内容信息 */}
  <div className="flex-1 min-w-0">
    <Link to={url} className="group">
      <h2 className="mb-2 text-lg font-semibold leading-tight group-hover:text-accent">
        {title}
      </h2>
      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
        {summary}
      </p>
    </Link>
    
    {/* 元信息 */}
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Link to={`/users/${author.username}`} className="hover:underline">
        {author.displayName}
      </Link>
      <span>·</span>
      <time>{timeAgo}</time>
      <span>·</span>
      <span>{contentType}</span>
    </div>
  </div>

  {/* 右侧：封面图（如果有） */}
  {coverImage && (
    <Link to={url} className="shrink-0">
      <img
        src={coverImage}
        alt=""
        className="h-24 w-32 rounded-lg object-cover"
      />
    </Link>
  )}
</article>
```

**关键点**：
- 标题 18px，最多两行
- 摘要 14px，固定两行
- 封面图 128×96px（16:9 比例）
- 卡片之间 `space-y-4`（16px）

---

### 4.4 话题广场优化

#### 当前问题
- 热门话题和最近活跃的双列布局可能不够清晰

#### 设计方案

**保持双列**（1:1）：
```tsx
<div className="grid gap-6 md:grid-cols-2">
  {/* 热门话题 */}
  <section>
    <h2 className="mb-4 text-lg font-semibold">热门话题</h2>
    <p className="mb-6 text-sm text-muted-foreground">按公开的数据排序</p>
    <div className="space-y-3">
      {hotTopics.map((topic, index) => (
        <Link
          key={topic.id}
          to={`/topics/${topic.id}`}
          className="flex items-center gap-4 rounded-lg p-4 hover:bg-surface-sunken"
        >
          <span className="text-2xl font-bold text-muted-foreground/50">
            {index + 1}
          </span>
          <div className="flex-1">
            <h3 className="font-semibold">{topic.name}</h3>
            <p className="text-sm text-muted-foreground">{topic.articleCount} 篇内容</p>
          </div>
        </Link>
      ))}
    </div>
  </section>

  {/* 最近活跃 */}
  <section>
    <h2 className="mb-4 text-lg font-semibold">最近活跃</h2>
    <p className="mb-6 text-sm text-muted-foreground">接近一次公开发布或修改</p>
    <div className="space-y-3">
      {activeTopics.map(topic => (
        <Link
          key={topic.id}
          to={`/topics/${topic.id}`}
          className="flex items-center gap-3 rounded-lg p-4 hover:bg-surface-sunken"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{topic.name}</h3>
            <p className="text-sm text-muted-foreground">{topic.recentActivity}</p>
          </div>
        </Link>
      ))}
    </div>
  </section>
</div>
```

**视觉区分**：
- 热门话题：序号 + 名称 + 数量
- 最近活跃：闪电图标 + 名称 + 活跃时间

---

## 五、星系页优化

### 5.1 官方星系 vs 探索星系

#### 当前问题
- 两个区域的视觉区分不够明显

#### 设计方案

**官方星系**（突出展示）：
```tsx
<section className="mb-8">
  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
    <Badge className="h-5 bg-accent">官方</Badge>
    官方星系
  </h2>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {officialGalaxies.map(galaxy => (
      <GalaxyCard key={galaxy.id} galaxy={galaxy} variant="official" />
    ))}
  </div>
</section>

<section>
  <h2 className="mb-4 text-lg font-semibold">探索星系</h2>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {galaxies.map(galaxy => (
      <GalaxyCard key={galaxy.id} galaxy={galaxy} variant="community" />
    ))}
  </div>
</section>
```

**卡片变体**：
- `variant="official"`：带 "官方" badge，强调色边框
- `variant="community"`：普通卡片

---

### 5.2 星系卡片优化

#### 设计方案

```tsx
<Link
  to={`/galaxies/${galaxy.id}`}
  className="group block overflow-hidden rounded-2xl border bg-card hover:shadow-md"
>
  {/* 顶部装饰 */}
  <div className="relative h-24 bg-gradient-to-br from-accent/20 to-accent/5">
    {galaxy.isOfficial && (
      <Badge className="absolute right-3 top-3 bg-accent">官方</Badge>
    )}
  </div>

  {/* 内容 */}
  <div className="p-5">
    <h3 className="mb-2 text-lg font-semibold group-hover:text-accent">
      {galaxy.name}
    </h3>
    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
      {galaxy.description}
    </p>

    {/* 底部信息 */}
    <div className="flex items-center justify-between border-t pt-3">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {galaxy.memberCount}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-4 w-4" />
          {galaxy.articleCount}
        </span>
      </div>
      <Button variant="outline" size="sm">
        {galaxy.isMember ? "已加入" : "加入"}
      </Button>
    </div>
  </div>
</Link>
```

---

## 六、文章阅读页优化

### 6.1 当前状态

文章阅读页使用 `ReaderFrame` 三轨布局，整体结构良好。

### 6.2 可选优化

**标题区优化**（可选）：
```tsx
<header className="mb-12">
  {/* eyebrow */}
  {series && (
    <Link to={`/series/${series.id}`} className="mb-2 block text-sm text-accent hover:underline">
      收录于系列：{series.title}
    </Link>
  )}

  {/* 标题 */}
  <h1 className="mb-4 text-4xl font-bold leading-tight">
    {article.title}
  </h1>

  {/* 摘要 */}
  {article.summary && (
    <p className="mb-6 text-lg text-muted-foreground">
      {article.summary}
    </p>
  )}

  {/* 元信息行 */}
  <div className="flex items-center gap-4 text-sm text-muted-foreground">
    <Link to={`/users/${author.username}`} className="flex items-center gap-2 hover:underline">
      <Avatar className="h-8 w-8" />
      <span>{author.displayName}</span>
    </Link>
    <span>·</span>
    <time>{publishedDate}</time>
    <span>·</span>
    <span>{readingTime} 分钟阅读</span>
  </div>

  {/* 分隔线 */}
  <hr className="mt-8 border-t" />
</header>
```

**保持不变**：
- 左栏：作者卡 + 发布日期 + 标签
- 右栏：字号/行距工具 + 目录 + 进度
- 正文：阅读宽度 717.785px

---

## 七、通用组件优化

### 7.1 空状态统一

**所有空状态使用统一结构**：
```tsx
<EmptyState
  icon={Users}
  title="还没有内容"
  description="这里会显示相关内容。"
  actions={[
    { label: "主要操作", to: "/path", variant: "accent" },
    { label: "次要操作", to: "/path", variant: "outline" },
  ]}
/>
```

**场景清单**：
- 首页关注 Tab 为空
- 发现页搜索无结果
- 话题详情页无内容
- 系列详情页无章节
- 星系页无星系
- 个人主页无内容

---

### 7.2 加载态优化

**骨架屏统一**：
```tsx
{/* 卡片骨架 */}
<div className="animate-pulse rounded-2xl border bg-card p-5">
  <div className="flex items-center gap-3 mb-3">
    <div className="h-10 w-10 rounded-full bg-muted" />
    <div className="flex-1">
      <div className="h-4 w-24 bg-muted rounded mb-2" />
      <div className="h-3 w-32 bg-muted rounded" />
    </div>
  </div>
  <div className="h-5 w-3/4 bg-muted rounded mb-2" />
  <div className="h-4 w-full bg-muted rounded mb-1" />
  <div className="h-4 w-5/6 bg-muted rounded" />
</div>
```

**使用场景**：
- 信息流加载
- 内容列表加载
- 卡片网格加载

---

## 八、实施计划

### Phase 2.2（1-2 周）

#### Week 1：首页 + 发现页
- [ ] Day 1-2：首页 Hero 压缩 + 信息流卡片优化
- [ ] Day 3-4：发现页 PageHero 压缩 + 列表优化
- [ ] Day 5：话题广场双列优化

#### Week 2：星系页 + 通用组件
- [ ] Day 1-2：星系页卡片优化 + 官方星系区分
- [ ] Day 3：统一空状态组件
- [ ] Day 4：统一加载态组件
- [ ] Day 5：全站测试和微调

---

## 九、验收标准

### 必须达到

- [ ] 首页 Hero（登录）高度 ≤ 80px
- [ ] 信息流卡片标题 18px，摘要两行
- [ ] 发现页 PageHero 高度 ≤ 120px
- [ ] 内容列表卡片信息层级清晰
- [ ] 话题广场双列视觉区分明显
- [ ] 星系卡片官方/社区区分清晰
- [ ] 空状态图标 64×64px，按钮 2 个
- [ ] 加载态骨架屏与实际内容结构一致

### 可以接受的不完美

- 部分动画可能不够流畅
- 空状态插图可以是图标，不必是插画
- 加载态可以简单，不必完全复刻实际内容

---

## 十、开发注意事项

### 10.1 代码规范

1. **复用现有组件**
   - Card、Button、Badge、Avatar
   - EmptyState、Skeleton（需新建）

2. **保持响应式**
   - 所有布局在 320-1920px 测试
   - 移动端优先

3. **性能考虑**
   - 图片懒加载
   - 列表虚拟滚动（如果数据量大）

### 10.2 测试清单

**视觉测试**：
- [ ] 卡片间距统一
- [ ] 标题大小层级清晰
- [ ] 空状态居中对齐
- [ ] 加载态动画流畅

**交互测试**：
- [ ] hover 状态正常
- [ ] 点击跳转正确
- [ ] 按钮可点击

**响应式测试**：
- [ ] 320px（移动端）
- [ ] 768px（平板）
- [ ] 1024px（笔记本）
- [ ] 1440px（桌面）

---

**文档结束**

开发者请按本文档实施 Phase 2.2 页面级架构优化。完成后星语社区的视觉和交互将达到专业水准。
