"use client";
import styles from "@/components/studio/studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentProfile } from "@/components/layout/current-profile-context";
import { StudioHubAside } from "@/components/studio/studio-hub-aside";
import { StudioHubHero } from "@/components/studio/studio-hub-hero";
import { StudioHubMetrics } from "@/components/studio/studio-hub-metrics";
import { StudioHubNav, StudioHubMobileNav } from "@/components/studio/studio-hub-nav";
import { StudioHubQuickCreate } from "@/components/studio/studio-hub-quick-create";
import { StudioHubRecent } from "@/components/studio/studio-hub-recent";
import { StudioHubTodos } from "@/components/studio/studio-hub-todos";
import { useStudioHubData } from "@/components/studio/use-studio-hub-data";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useTimeGreeting } from "@/lib/use-time-greeting";

export default function StudioPage() {
  const router = useRouter();
  const greeting = useTimeGreeting();
  const currentProfile = useCurrentProfile();
  const hub = useStudioHubData();
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const scheduledIds = useMemo(() => new Set(hub.scheduledMap.keys()), [hub.scheduledMap]);

  const displayName =
    hub.profile?.displayName ||
    hub.profile?.username ||
    currentProfile.displayName ||
    currentProfile.username ||
    "星语者";

  const latestDraft = useMemo(
    () =>
      [...hub.articles]
        .filter((article) => article.status === "DRAFT")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    [hub.articles]
  );

  async function createArticle() {
    setCreateError(null);
    setCreating(true);
    try {
      const created = await communityApi.createArticle();
      router.push(`/studio/content/${created.articleId}`);
    } catch {
      setCreateError("创建文章失败，请确认登录状态后重试。");
      setCreating(false);
    }
  }

  if (hub.unauthorized) {
    return (
      <AppShell>
        <main className={cn(styles.studioHub)}>
          <div className={cn(styles.state)} role="alert">
            <h1>请先登录</h1>
            <p>登录后即可使用创作中心管理你的内容。</p>
            <Button asChild>
              <Link href="/login">
                <LogIn aria-hidden="true" />
                去登录
              </Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );
  }

  if (hub.forbidden) {
    return (
      <AppShell>
        <main className={cn(styles.studioHub)}>
          <div className={cn(styles.state)} role="alert">
            <h1>暂无访问权限</h1>
            <p>{hub.error || "当前账号无法访问创作中心。"}</p>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className={cn(styles.studioHub)}>
        {createError || hub.error ? (
          <Alert variant="destructive" className={cn(styles.alert)}>
            <span>{createError || hub.error}</span>
            {hub.error && !createError ? (
              <button type="button" className={cn(styles.retry)} onClick={hub.reload}>
                <RefreshCw aria-hidden="true" />
                重试
              </button>
            ) : null}
          </Alert>
        ) : null}

        <StudioHubMobileNav />

        <div className={cn(styles.layout)}>
          <div className={cn(styles.rail, styles.railLeft)}>
            <StudioHubNav onCreateArticle={() => void createArticle()} creating={creating} />
          </div>

          <div className={cn(styles.main)}>
            <StudioHubHero
              greeting={greeting}
              displayName={displayName}
              latestDraft={latestDraft}
              loading={hub.loading}
              onCreateArticle={() => void createArticle()}
            />
            <StudioHubQuickCreate onCreateArticle={() => void createArticle()} creating={creating} />
            <StudioHubRecent
              articles={hub.articles}
              scheduledIds={scheduledIds}
              loading={hub.loading}
              onCreateArticle={() => void createArticle()}
            />
            <StudioHubMetrics insights={hub.insights} loading={hub.loading} />
            <StudioHubTodos todos={hub.todos} loading={hub.loading} />
          </div>

          <div className={cn(styles.rail, styles.railRight)}>
            <StudioHubAside announcements={hub.announcements} loading={hub.loading} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
