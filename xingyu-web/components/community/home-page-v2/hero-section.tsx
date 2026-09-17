"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useTimeGreeting } from "@/lib/use-time-greeting";
import { useSmartActions, generateSmartSummary } from "@/lib/hooks/use-smart-actions";
import type { UserState } from "./types";
import styles from "./hero-section.module.css";

type HeroSectionProps = {
  profile: {
    username?: string;
    displayName?: string;
    avatar?: string;
  };
  userState: UserState;
  isGuest: boolean;
};

/**
 * Hero 区域组件
 * 首屏焦点，提供情感化欢迎和智能快捷操作
 */
export function HeroSection({ profile, userState, isGuest }: HeroSectionProps) {
  const timeGreeting = useTimeGreeting();
  const smartActions = useSmartActions(userState, isGuest);

  const avatarLabel = profile.displayName || profile.username || "星语";
  const greeting = isGuest ? "欢迎来到星语" : timeGreeting;
  const summary = isGuest
    ? "探索创作者们的精彩内容，加入星语社区"
    : generateSmartSummary(userState);

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      {/* 动态背景 */}
      <div className={styles.heroBackground} aria-hidden="true" />

      {/* 内容 */}
      <div className={styles.heroContent}>
        <div className={styles.heroHeader}>
          {!isGuest && profile.avatar && (
            <Avatar
              src={profile.avatar}
              fallback={avatarLabel}
              size="xl"
              className={styles.heroAvatar}
              alt={`${avatarLabel} 的头像`}
            />
          )}

          <h1 id="hero-title" className={styles.heroTitle}>
            <span className={styles.greeting}>{greeting}</span>
            {!isGuest && profile.username && (
              <span className={styles.username}>@{profile.username}</span>
            )}
          </h1>
        </div>

        {/* 智能摘要 */}
        <p className={styles.heroSummary}>{summary}</p>

        {/* 智能快捷操作 */}
        <nav className={styles.heroActions} aria-label="快捷操作">
          {smartActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={styles.actionButton}
              data-variant={action.variant}
            >
              <action.icon aria-hidden="true" />
              {action.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
