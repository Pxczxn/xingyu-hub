> **归档说明（Legacy Web 过渡文档）**
> 本文档记录 Legacy Web 的 **Home V2 过渡实现**。Legacy Web 曾同时存在 **Home V1**（`components/community/home-page.tsx`）与 **Home V2**（`components/community/home-page-v2/`）两套首页实现。
> 它**不代表**未来 Web 重构必须保留双实现，也**不应**作为新 Web 路由 / 架构的权威来源。
> 可用于参考已确认的首页产品设计与交互；如未来 Web 已重新设计首页，本文件可随 Legacy 下线而归档。

# 星语社区首页 V2

## 概述

全新设计的首页，提供更好的视觉体验和用户交互。

## 主要改进

### 1. **Hero 区域**
- 大尺寸情感化欢迎
- 智能时段问候（早上好/下午好/晚上好）
- 基于用户状态的智能快捷操作
- 动态渐变背景

### 2. **优化的信息架构**
- 从 7 个区块简化为 3 层渐进披露
- Hero → 关注动态 → 为你发现
- 右侧聚合侧边栏（话题/星系/公告）

### 3. **统一的卡片组件**
- `ContentCardV2` 替代多个不同的卡片组件
- 支持 3 种变体：standard / compact / feature
- 响应式布局，移动端友好

### 4. **聚合侧边栏**
- Tab 切换显示：话题雷达 / 星系 / 公告
- 新增"我的快捷方式"区块
- 减少视觉噪音

### 5. **性能优化**
- 组件拆分，按需加载
- CSS 动画替代 JS 动画
- 图片懒加载
- 骨架屏加载状态

## 如何启用

### 方法 1：环境变量（推荐）

在项目根目录创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_USE_V2_HOME=true
```

然后重启开发服务器：

```bash
npm run dev
```

### 方法 2：URL 参数（临时测试）

访问首页时添加 `?v2=true` 参数：

```
http://localhost:7777/?v2=true
```

这个方法不需要重启服务器，方便快速测试。

## 文件结构

```
xingyu-web/
├── components/
│   └── community/
│       ├── home-page.tsx              # 旧版首页（保留）
│       ├── home-page-v2/              # 新版首页
│       │   ├── index.tsx              # 主组件
│       │   ├── hero-section.tsx       # Hero 区域
│       │   ├── feed-section.tsx       # 关注动态
│       │   ├── discover-section.tsx   # 为你发现
│       │   ├── radar-panel.tsx        # 侧边栏
│       │   └── types.ts               # 类型定义
│       └── shared/                    # 共享组件
│           ├── content-card-v2.tsx    # 统一卡片
│           ├── skeleton-card.tsx      # 骨架屏
│           └── empty-state-v2.tsx     # 空状态
├── lib/
│   ├── hooks/
│   │   ├── use-smart-actions.ts       # 智能快捷操作
│   │   └── use-intersection-observer.ts # 懒加载
│   └── utils/
│       └── content-helpers.ts         # 内容工具函数
└── styles/
    └── home-v2.css                    # 全局 V2 样式变量
```

## 组件说明

### HeroSection
**功能**：情感化欢迎 + 智能快捷操作

**智能快捷操作逻辑**：
1. 有草稿 → "继续创作 (N)"
2. 有阅读进度 → "继续阅读《xxx》"
3. 新用户 → "完成新手引导"
4. 默认 → "去探索"

### FeedSection
**功能**：显示关注的创作者的最新更新

**特点**：
- 2 列等宽网格（移动端 1 列）
- 使用 `ContentCardV2` 统一样式
- 空状态友好提示

### DiscoverSection
**功能**：推荐内容展示

**特点**：
- 第 1 篇：特色大卡片（2 列布局）
- 其他：3 列网格（响应式）
- "换一批"功能

### RadarPanel
**功能**：聚合侧边信息

**Tab 切换**：
- 话题雷达：热门话题排行
- 星系：用户加入的星系
- 公告：系统公告

**快捷方式**：
- 创作中心
- 收藏夹
- 阅读历史
- 草稿箱

## 响应式断点

- **移动端**: < 768px
- **平板**: 768px - 1023px
- **桌面**: ≥ 1024px

## 浏览器支持

- Chrome/Edge ≥ 90
- Firefox ≥ 88
- Safari ≥ 14

## 无障碍特性

- 语义化 HTML
- ARIA 标签
- 键盘导航支持
- 减少动画模式支持

## 性能指标

- 首屏加载 < 2s（3G 网络）
- Lighthouse 性能分数 > 90
- 无障碍分数 > 95

## 已知限制

1. **智能快捷操作**：目前 `unreadCount` 和 `onboardingCompleted` 使用硬编码值，待对接实际 API
2. **图片优化**：暂未实现响应式图片，使用占位图
3. **动画库**：未使用 Framer Motion，仅使用 CSS 动画

## 开发计划

### 短期（已完成）
- [x] Hero 区域
- [x] 统一卡片组件
- [x] 关注动态重构
- [x] 为你发现优化
- [x] 聚合侧边栏
- [x] 响应式布局

### 中期（待完成）
- [ ] 继续你的旅程（横向滑动）
- [ ] 图片响应式优化
- [ ] 暗色模式支持
- [ ] 完善骨架屏细节

### 长期
- [ ] 个性化推荐算法
- [ ] PWA 支持
- [ ] 多语言支持

## 回滚方案

如果遇到问题，可以随时回退到旧版：

1. 删除 `.env.local` 中的 `NEXT_PUBLIC_USE_V2_HOME` 配置
2. 或设置为 `false`：
   ```bash
   NEXT_PUBLIC_USE_V2_HOME=false
   ```
3. 重启开发服务器

旧版代码完整保留在 `components/community/home-page.tsx`。

## 反馈

如有问题或建议，请提交 Issue 或联系开发团队。
