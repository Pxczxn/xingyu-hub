"use client";

import { useMemo } from "react";
import { PenLine, BookOpen, Compass, Sparkles } from "lucide-react";
import type { SmartAction, UserState } from "@/components/community/home-page-v2/types";

/**
 * 根据用户状态智能生成快捷操作按钮
 * 优先级：草稿 > 阅读进度 > 新手引导 > 默认探索
 */
export function useSmartActions(userState: UserState, isGuest: boolean): SmartAction[] {
  return useMemo(() => {
    if (isGuest) {
      return [
        {
          label: "去探索",
          href: "/discover",
          icon: Sparkles,
          variant: "primary",
        },
        {
          label: "阅读指南",
          href: "/guide",
          icon: BookOpen,
          variant: "secondary",
        },
      ];
    }

    const actions: SmartAction[] = [];

    // 规则 1: 有未完成草稿 → 优先级最高
    if (userState.draftCount > 0) {
      actions.push({
        label: `继续创作 (${userState.draftCount})`,
        href: "/studio/drafts",
        icon: PenLine,
        variant: "primary",
      });
    }

    // 规则 2: 有阅读进度
    if (userState.continueReading.length > 0) {
      const article = userState.continueReading[0];
      const truncatedTitle = article.title.length > 20
        ? article.title.slice(0, 20) + "..."
        : article.title;

      actions.push({
        label: `继续阅读《${truncatedTitle}》`,
        href: `/articles/${article.id}`,
        icon: BookOpen,
        variant: actions.length === 0 ? "primary" : "secondary",
      });
    }

    // 规则 3: 新用户引导
    if (!userState.onboardingCompleted && actions.length < 2) {
      actions.push({
        label: "完成新手引导",
        href: "/onboarding",
        icon: Compass,
        variant: actions.length === 0 ? "primary" : "secondary",
      });
    }

    // 默认：去探索
    if (actions.length === 0) {
      actions.push({
        label: "去探索",
        href: "/discover",
        icon: Sparkles,
        variant: "primary",
      });
    }

    // 最多返回 3 个
    return actions.slice(0, 3);
  }, [userState, isGuest]);
}

/**
 * 生成智能状态摘要（一句话总结）
 */
export function generateSmartSummary(userState: UserState): string {
  const parts: string[] = [];

  if (userState.unreadCount > 0) {
    parts.push(`${userState.unreadCount} 条未读消息`);
  }

  if (userState.draftCount > 0) {
    parts.push(`${userState.draftCount} 篇草稿待完成`);
  }

  if (userState.continueReading.length > 0) {
    parts.push(`${userState.continueReading.length} 篇内容待继续阅读`);
  }

  if (parts.length === 0) {
    return "一切就绪，开始探索星语社区吧";
  }

  return `你有 ${parts.join("，")}`;
}
