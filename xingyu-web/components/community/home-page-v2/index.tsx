"use client";

import { HeroSection } from "./hero-section";
import { FeedSection } from "./feed-section";
import { DiscoverSection } from "./discover-section";
import { RadarPanel } from "./radar-panel";
import type { HomeV2Props } from "./types";
import styles from "./index.module.css";

/**
 * 星语社区首页 V2
 *
 * 主要改进：
 * 1. 新增 Hero 区域 - 情感化欢迎 + 智能快捷操作
 * 2. 优化信息架构 - 从 7 个区块优化为 3 层渐进披露
 * 3. 统一卡片组件 - 使用 ContentCardV2 替代多个不同卡片
 * 4. 聚合侧边栏 - Tab 切换显示话题/星系/公告
 * 5. 性能优化 - 组件拆分、懒加载、动画优化
 */
export function HomePageV2({
  isGuest,
  loading,
  profile,
  userState,
  continueReading,
  followUpdates,
  recommendations,
  topics,
  announcements,
  galaxies,
  series,
}: HomeV2Props) {
  return (
    <div className={styles.homeV2}>
      {/* Hero 区域 - 首屏焦点 */}
      <HeroSection
        profile={profile}
        userState={userState}
        isGuest={isGuest}
      />

      {/* 主布局：内容 + 侧边栏 */}
      <div className={styles.mainLayout}>
        {/* 主内容列 */}
        <main className={styles.mainColumn}>
          {/* 关注动态 */}
          <FeedSection
            items={followUpdates}
            isGuest={isGuest}
            loading={loading}
          />

          {/* 为你发现 */}
          <DiscoverSection
            items={recommendations}
            loading={loading}
          />
        </main>

        {/* 侧边栏 */}
        <aside className={styles.sideColumn}>
          <RadarPanel
            topics={topics}
            galaxies={galaxies}
            announcements={announcements}
            isGuest={isGuest}
          />
        </aside>
      </div>
    </div>
  );
}

/**
 * 导出所有子组件，便于单独使用
 */
export { HeroSection } from "./hero-section";
export { FeedSection } from "./feed-section";
export { DiscoverSection } from "./discover-section";
export { RadarPanel } from "./radar-panel";
export type { HomeV2Props, UserState, SmartAction } from "./types";
