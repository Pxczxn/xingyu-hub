"use client";

import { useMemo } from "react";
import type {
  AnnouncementSummary,
  ArticleSummary,
  InsightsView,
  MeHomeView,
  PendingAction,
  ProfileDetail,
} from "@/lib/community-api";
import { communityApi } from "@/lib/community-api";
import { ApiError } from "@/lib/api-client";
import { resolveArticleDisplayStatus } from "@/lib/studio-article-status";
import { useAsyncData } from "@/lib/use-async-data";

export type StudioTodoItem = {
  id: string;
  icon: "returned" | "scheduled" | "review" | "collaboration" | "action";
  title: string;
  time: string;
  href: string;
  isNew?: boolean;
};

export type StudioHubData = {
  profile: ProfileDetail | null;
  articles: ArticleSummary[];
  insights: InsightsView | null;
  home: MeHomeView | null;
  announcements: AnnouncementSummary[];
  scheduledMap: Map<string, string>;
  todos: StudioTodoItem[];
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  unauthorized: boolean;
  reload: () => void;
};

const RECENT_PAGE_SIZE = 8;
const SCHEDULED_PROBE_LIMIT = 12;

async function loadScheduledMap(articles: ArticleSummary[]): Promise<Map<string, string>> {
  const drafts = articles
    .filter((article) => article.status === "DRAFT")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, SCHEDULED_PROBE_LIMIT);

  const entries = await Promise.all(
    drafts.map(async (article) => {
      try {
        const draft = await communityApi.getArticleDraft(article.id);
        if (!draft.scheduledPublishAt) return null;
        const scheduledAt = new Date(draft.scheduledPublishAt);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return null;
        return [article.id, draft.scheduledPublishAt] as const;
      } catch {
        return null;
      }
    })
  );

  return new Map(entries.filter(Boolean) as Array<[string, string]>);
}

function classifyError(err: unknown): { message: string; forbidden: boolean; unauthorized: boolean } {
  if (err instanceof ApiError) {
    const status = err.problem.status;
    if (status === 401) {
      return { message: "请先登录后访问创作中心。", unauthorized: true, forbidden: false };
    }
    if (status === 403) {
      return { message: "当前账号暂无创作中心访问权限。", unauthorized: false, forbidden: true };
    }
    return {
      message: String(err.problem.detail || err.problem.title || "加载失败"),
      unauthorized: false,
      forbidden: false,
    };
  }
  return { message: "加载失败，请稍后重试。", unauthorized: false, forbidden: false };
}

export function useStudioHubData(): StudioHubData {
  const bundleState = useAsyncData(async () => {
    try {
      const [profile, articles, insights, home, announcements] = await Promise.all([
        communityApi.getMyProfile(),
        communityApi.listMyArticles(),
        communityApi.getMyInsights(),
        communityApi.getHome().catch(() => null),
        communityApi.getAnnouncements(3).catch(() => [] as AnnouncementSummary[]),
      ]);
      const scheduledMap = await loadScheduledMap(articles);
      return { profile, articles, insights, home, announcements, scheduledMap, fault: null };
    } catch (err) {
      return {
        profile: null,
        articles: [] as ArticleSummary[],
        insights: null,
        home: null,
        announcements: [] as AnnouncementSummary[],
        scheduledMap: new Map<string, string>(),
        fault: classifyError(err),
      };
    }
  }, []);

  const scheduledMap = bundleState.data?.scheduledMap ?? new Map<string, string>();
  const scheduledIds = useMemo(() => new Set(scheduledMap.keys()), [scheduledMap]);

  const todos = useMemo(() => buildTodos(bundleState.data, scheduledMap, scheduledIds), [
    bundleState.data,
    scheduledMap,
    scheduledIds,
  ]);

  return {
    profile: bundleState.data?.profile ?? null,
    articles: bundleState.data?.articles ?? [],
    insights: bundleState.data?.insights ?? null,
    home: bundleState.data?.home ?? null,
    announcements: bundleState.data?.announcements ?? [],
    scheduledMap,
    loading: bundleState.loading,
    error: bundleState.data?.fault?.message ?? bundleState.error,
    forbidden: bundleState.data?.fault?.forbidden ?? false,
    unauthorized: bundleState.data?.fault?.unauthorized ?? false,
    reload: bundleState.reload,
    todos,
  };
}

function buildTodos(
  data: {
    articles: ArticleSummary[];
    home: MeHomeView | null;
  } | null | undefined,
  scheduledMap: Map<string, string>,
  scheduledIds: ReadonlySet<string>
): StudioTodoItem[] {
  if (!data) return [];
  const items: StudioTodoItem[] = [];

  for (const article of data.articles) {
    const status = resolveArticleDisplayStatus(article, scheduledIds);
    if (status.tone === "returned") {
      items.push({
        id: `returned-${article.id}`,
        icon: "returned",
        title: `文章《${article.title || "未命名文章"}》被退回，需要修改后重新提交`,
        time: article.updatedAt,
        href: `/studio/content/${encodeURIComponent(article.id)}`,
        isNew: true,
      });
    }
    if (scheduledMap.has(article.id)) {
      items.push({
        id: `scheduled-${article.id}`,
        icon: "scheduled",
        title: `定时发布：文章《${article.title || "未命名文章"}》将于 ${formatScheduledLabel(scheduledMap.get(article.id)!)} 发布`,
        time: article.updatedAt,
        href: `/studio/content/${encodeURIComponent(article.id)}`,
      });
    }
  }

  for (const action of data.home?.pendingActions ?? []) {
    items.push({
      id: `action-${action.type}-${action.href}`,
      icon: mapPendingIcon(action),
      title: action.title,
      time: "",
      href: action.href,
    });
  }

  return items
    .sort((a, b) => (b.time || "").localeCompare(a.time || ""))
    .slice(0, 12);
}

function mapPendingIcon(action: PendingAction): StudioTodoItem["icon"] {
  if (action.type === "REVIEW") return "review";
  if (action.href.includes("collaboration")) return "collaboration";
  return "action";
}

function formatScheduledLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export { RECENT_PAGE_SIZE };
