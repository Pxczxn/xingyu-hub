"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage } from "@/components/community/home-page";
import {
  communityApi,
  type ContentSummary,
  type GalaxySummary,
  type PendingAction,
  type SeriesSummary,
} from "@/lib/community-api";
import { useTimeGreeting } from "@/lib/use-time-greeting";
import { AUTH_CHANGED_EVENT } from "@/lib/api-client";

type HomeContent = {
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  draftArticles: ContentSummary[];
  pendingActions: PendingAction[];
  isGuest: boolean;
};

export default function HomePageRoute() {
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
  const timeGreeting = useTimeGreeting();
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
  const [galaxies, setGalaxies] = useState<GalaxySummary[]>([]);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      setGalaxies([]);
      setSeries([]);
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
        setGalaxies([]);
        setSeries([]);
        return;
      }
      setProfileName(profile.displayName || profile.username || null);
      const [home, followingFeed, recommendedFeed, myGalaxies, mySeries] = await Promise.all([
        communityApi.getHome(),
        communityApi.getFeed("following", 0, 10).catch(() => []),
        communityApi.getFeed("recommended", 0, 12).catch(() => []),
        communityApi.getMyGalaxies().catch(() => []),
        communityApi.listMySeries().catch(() => []),
      ]);
      setGalaxies(myGalaxies);
      setSeries(mySeries);
      setContent({
        ...home,
        followUpdates: followingFeed.length ? followingFeed : home.followUpdates,
        recommendations: recommendedFeed.length ? recommendedFeed : home.recommendations,
        draftArticles: home.draftArticles ?? [],
        pendingActions: home.pendingActions ?? [],
        isGuest: false,
      });
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
      setGalaxies([]);
      setSeries([]);
    }
  }, [mode]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    function handleAuthChanged() {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
  }, [load]);

  const greetingLead = content.isGuest
    ? "欢迎来到星语社区"
    : profileName
      ? timeGreeting
      : "欢迎来到星语社区";
  const showUsernameChip = !content.isGuest && Boolean(profileName);

  return (
    <AppShell>
      <HomePage
        isGuest={content.isGuest}
        loading={loading}
        greetingLead={greetingLead}
        showUsernameChip={showUsernameChip}
        continueReading={content.continueReading}
        followUpdates={content.followUpdates}
        recommendations={content.recommendations}
        topics={topics}
        announcements={announcements}
        galaxies={galaxies}
        series={series}
      />
    </AppShell>
  );
}
