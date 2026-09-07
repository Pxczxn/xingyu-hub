"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { HomePrototypePage } from "@/components/community/home-prototype-page";
import { communityApi, type ContentSummary, type PendingAction } from "@/lib/community-api";

type HomeContent = {
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  draftArticles: ContentSummary[];
  pendingActions: PendingAction[];
  isGuest: boolean;
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <AppShell>
      <main className="xy-page">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </main>
    </AppShell>
  );
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const [content, setContent] = useState<HomeContent>({
    continueReading: [],
    followUpdates: [],
    recommendations: [],
    draftArticles: [],
    pendingActions: [],
    isGuest: true,
  });
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof communityApi.getTopics>>>([]);
  const [announcements, setAnnouncements] = useState<Awaited<ReturnType<typeof communityApi.getAnnouncements>>>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [greetingMeta, setGreetingMeta] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [topicList, announcementList] = await Promise.all([
        communityApi.getTopics(),
        communityApi.getAnnouncements(3),
      ]);
      setTopics(topicList);
      setAnnouncements(announcementList);

      if (mode === "guest") {
        const guest = await communityApi.getGuestHome();
        setContent({
          continueReading: [],
          followUpdates: guest.followingUpdates,
          recommendations: guest.discoveries,
          draftArticles: [],
          pendingActions: [],
          isGuest: true,
        });
        setProfileName(null);
        setGreetingMeta(null);
        return;
      }

      try {
        const profile = await communityApi.tryGetMyProfile();
        if (!profile) {
          const guest = await communityApi.getGuestHome();
          setContent({
            continueReading: [],
            followUpdates: guest.followingUpdates,
            recommendations: guest.discoveries,
            draftArticles: [],
            pendingActions: [],
            isGuest: true,
          });
          setProfileName(null);
          return;
        }
        setProfileName(profile.displayName || profile.username || null);
        const home = await communityApi.getHome();
        const insights = await communityApi.getMyInsights().catch(() => null);
        const readingCount = home.continueReading.length;
        const metaParts = [
          insights?.articleCount ? `已发布 ${insights.articleCount} 篇内容` : null,
          readingCount ? `继续阅读 ${readingCount} 篇` : null,
        ].filter(Boolean);
        setGreetingMeta(metaParts.length ? metaParts.join(" · ") : "继续你的阅读与创作旅程");
        setContent({ ...home, draftArticles: home.draftArticles ?? [], pendingActions: home.pendingActions ?? [], isGuest: false });
      } catch {
        const guest = await communityApi.getGuestHome();
        setContent({
          continueReading: [],
          followUpdates: guest.followingUpdates,
          recommendations: guest.discoveries,
          draftArticles: [],
          pendingActions: [],
          isGuest: true,
        });
        setProfileName(null);
        setGreetingMeta(null);
      }
    }

    load().finally(() => setLoading(false));
  }, [mode]);

  const greeting = content.isGuest
    ? "欢迎来到星语社区"
    : profileName
      ? `晚上好，${profileName}`
      : "欢迎来到星语社区";

  return (
    <AppShell>
      <HomePrototypePage
        isGuest={content.isGuest}
        loading={loading}
        greeting={greeting}
        greetingMeta={greetingMeta}
        continueReading={content.continueReading}
        followUpdates={content.followUpdates}
        recommendations={content.recommendations}
        topics={topics}
        announcements={announcements}
      />
    </AppShell>
  );
}
