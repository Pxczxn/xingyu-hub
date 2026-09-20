import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { homeApi } from "@/api/home/home.api";
import type { GuestHomeView, MeHomeView } from "@/api/home/home.types";
import { topicsApi } from "@/api/topics/topics.api";
import { discoverApi } from "@/api/discover/discover.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import type { AnnouncementSummary, ContentSummary } from "@/api/common.types";
import { useAuth } from "@/features/auth/auth.store";
import { ContentCard } from "@/components/shared/ContentCard";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/*
 * Home — the single canonical home page for Web V2.
 * No dual home implementation, no feature flag, no query-string version switch.
 * Guest vs member only changes the data source, never the structure.
 *
 * First screen : 社区公告 / 关注更新 + 继续阅读 (继续阅读 wider) / sticky sub-nav
 * Second screen: 为你推荐 / Discover + Topic 混排
 *
 * Every non-critical section degrades independently: a failing endpoint shows
 * an error inside that section only (never a blank page).
 */

type Section<T> = { status: SectionStatus; data: T | null };

const SUB_NAV = [
  { id: "recommend", label: "推荐" },
  { id: "following", label: "关注" },
  { id: "latest", label: "最新" },
];

function useSection<T>(loader: () => Promise<T>, deps: unknown[]): Section<T> {
  const [section, setSection] = useState<Section<T>>({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    setSection({ status: "loading", data: null });
    loader()
      .then((data) => {
        if (!active) return;
        setSection({ status: "ready", data });
      })
      .catch(() => {
        if (!active) return;
        setSection({ status: "error", data: null });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return section;
}

function contentStatus<T>(section: Section<unknown>, items: T[] | undefined): SectionStatus {
  if (section.status !== "ready") return section.status;
  return items && items.length > 0 ? "ready" : "empty";
}

export function HomePage() {
  const { status: authStatus, isAuthenticated } = useAuth();
  const ready = authStatus === "authenticated" || authStatus === "unauthenticated";

  const [guestHome, setGuestHome] = useState<GuestHomeView | null>(null);
  const [myHome, setMyHome] = useState<MeHomeView | null>(null);
  const [homeStatus, setHomeStatus] = useState<SectionStatus>("loading");
  const [homeFatal, setHomeFatal] = useState(false);

  // Home composition: guest vs member hit different endpoints, same layout.
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setHomeStatus("loading");
    setHomeFatal(false);
    const loader = isAuthenticated ? homeApi.getMyHome() : homeApi.getGuestHome();
    loader
      .then((data) => {
        if (!active) return;
        if (isAuthenticated) setMyHome(data as MeHomeView);
        else setGuestHome(data as GuestHomeView);
        setHomeStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setHomeStatus("error");
        setHomeFatal(true);
      });
    return () => {
      active = false;
    };
  }, [ready, isAuthenticated]);

  // Non-critical sections, isolated so failures cannot blank the page.
  const announcements = useSection<AnnouncementSummary[]>(() => homeApi.getAnnouncements(3), [ready]);
  const topics = useSection<TopicSummary[]>(() => topicsApi.getTopics(), [ready]);

  // The discover rail uses the real discover endpoint for members, so it never
  // duplicates the 为你推荐 section. Guests use the discoveries in their home payload.
  const discoverFeed = useSection<ContentSummary[]>(
    async () => (isAuthenticated ? (await discoverApi.getDiscover({ limit: 4 })).items ?? [] : []),
    [ready, isAuthenticated],
  );

  const continueReading: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.continueReading
    : guestHome?.continueReading;
  const followingUpdates: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.followUpdates
    : guestHome?.followingUpdates;
  const recommendations: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.recommendations
    : guestHome?.discoveries;
  const mixed: ContentSummary[] | undefined = isAuthenticated
    ? (discoverFeed.data ?? [])
    : guestHome?.discoveries;

  const homeSectionStatus = (items: ContentSummary[] | undefined): SectionStatus =>
    homeStatus === "ready" ? (items && items.length > 0 ? "ready" : "empty") : homeStatus;

  const mixedStatus: SectionStatus = isAuthenticated
    ? contentStatus(discoverFeed, discoverFeed.data ?? undefined)
    : homeSectionStatus(mixed);

  if (homeFatal) {
    return <PageState kind="error" />;
  }

  return (
    <div className="section-gap">
      {/* Sticky sub-nav */}
      <nav
        aria-label="首页分区"
        className="sticky top-14 z-20 -mx-4 flex gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6"
      >
        {SUB_NAV.map((item, index) => (
          <span
            key={item.id}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              index === 0
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </span>
        ))}
      </nav>

      {/* 1. 社区公告 (first screen) */}
      <section aria-labelledby="home-announcements">
        <h2 id="home-announcements" className="mb-3 text-base font-semibold text-primary">
          社区公告
        </h2>
        <SectionState
          status={contentStatus(announcements, announcements.data ?? undefined)}
          emptyText="暂无公告"
        >
          <ul className="flex flex-col gap-2">
            {(announcements.data ?? []).map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.body ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionState>
      </section>

      {/* 2. 关注更新 + 继续阅读 (same row; 继续阅读 is wider) */}
      <section aria-label="关注更新与继续阅读" className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-primary">关注更新</h2>
          <SectionState
            status={homeSectionStatus(followingUpdates)}
            emptyText={isAuthenticated ? "还没有关注更新，去发现看看" : "登录后可见关注更新"}
          >
            <div className="flex flex-col gap-3">
              {(followingUpdates ?? []).slice(0, 4).map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </SectionState>
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-base font-semibold text-primary">继续阅读</h2>
          <SectionState status={homeSectionStatus(continueReading)} emptyText="暂无继续阅读的内容">
            <div className="grid gap-3 sm:grid-cols-2">
              {(continueReading ?? []).slice(0, 4).map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </SectionState>
        </div>
      </section>

      {/* 3. 为你推荐 (second screen) */}
      <section aria-labelledby="home-recommended">
        <h2 id="home-recommended" className="mb-3 text-base font-semibold text-primary">
          为你推荐
        </h2>
        <SectionState status={homeSectionStatus(recommendations)} emptyText="暂无推荐内容">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(recommendations ?? []).slice(0, 6).map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </SectionState>
      </section>

      {/* 4. Discover / Topic 混排 (second screen) */}
      <section aria-labelledby="home-discover">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="home-discover" className="text-base font-semibold text-primary">
            发现 · 话题
          </h2>
          <Link to="/discover" className="text-sm text-accent hover:underline">
            去发现 ›
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionState status={mixedStatus} emptyText="暂无发现内容">
              <div className="grid gap-4 sm:grid-cols-2">
                {(mixed ?? []).slice(0, 4).map((item) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            </SectionState>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-primary">热门话题</h3>
            <SectionState status={contentStatus(topics, topics.data ?? undefined)} emptyText="暂无话题">
              <ul className="flex flex-col gap-2">
                {(topics.data ?? []).slice(0, 5).map((topic) => (
                  <li key={topic.id}>
                    <Link
                      to={`/topics/${topic.slug}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm hover:bg-muted"
                    >
                      <span className="truncate font-medium">{topic.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {topic.contentCount ?? 0} 内容
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionState>
          </div>
        </div>
      </section>
    </div>
  );
}
