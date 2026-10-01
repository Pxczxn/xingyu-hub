import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Sparkles } from "lucide-react";
import { homeApi } from "@/api/home/home.api";
import type { GuestHomeView, MeHomeView } from "@/api/home/home.types";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { eventsApi } from "@/api/events/events.api";
import type { EventView } from "@/api/events/events.types";
import type { AnnouncementSummary, ContentSummary } from "@/api/common.types";
import { useAuth } from "@/features/auth/auth.store";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { PageState } from "@/components/shared/PageState";
import { PageHero } from "@/components/shared/PageHero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HomeFeedTabs, type HomeFeedTab } from "@/features/home/components/HomeFeedTabs";
import { HomeFeedItem } from "@/features/home/components/HomeFeedItem";
import { ContinueReadingStrip } from "@/features/home/components/ContinueReadingStrip";
import { HomeSidebar, hasSidebarContent } from "@/features/home/components/HomeSidebar";
import { HomeHeroArt } from "@/features/home/components/HomeHeroArt";
import { EVENT_LIMIT } from "@/features/home/components/CommunityEventsPanel";
import { useRecommendedCreators } from "@/features/home/use-recommended-creators";

/*
 * Home — the single canonical home page for Web V2.
 * No dual home implementation, no feature flag, no query-string version switch.
 * Guest vs member only changes the data source and the hero's call to action,
 * never the structure.
 *
 * Information architecture: a community content FEED, not a module-card
 * dashboard. This file owns data state and composition only — every visual unit
 * lives in ./components.
 *
 *   PageHero          (guest: 加入星语 / 登录)
 *   ├── left  (2/3)   HomeFeedTabs (推荐 / 关注 + 查看更多)
 *   │                 → ContinueReadingStrip → feed rows
 *   └── right (1/3)   HomeSidebar (热门话题 · 推荐创作者 · 社区活动)
 *
 * Every non-critical section degrades independently: a failing endpoint shows an
 * error inside that section only (never a blank page), and the home-specific
 * rule for non-critical modules is "empty means invisible" (see HomeSidebar).
 */

type Section<T> = { status: SectionStatus; data: T | null };

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
  const [tab, setTab] = useState<HomeFeedTab>("recommend");

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

  // Non-critical rail modules, isolated so failures cannot blank the page.
  const announcements = useSection<AnnouncementSummary[]>(
    () => homeApi.getAnnouncements(3),
    [ready],
  );
  const topics = useSection<TopicSummary[]>(() => topicsApi.getTopics(), [ready]);
  const events = useSection<EventView[]>(() => eventsApi.list(EVENT_LIMIT), [ready]);
  const creators = useRecommendedCreators(ready, isAuthenticated);

  /*
   * Both feed tabs read the SAME composition payload — there is no separate feed
   * endpoint and none is invented. Guest 推荐 reuses `discoveries`, which is the
   * guest-side recommendations list.
   */
  const recommendations: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.recommendations
    : guestHome?.discoveries;
  const following: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.followUpdates
    : guestHome?.followingUpdates;

  // 继续阅读 is a resume affordance: signed-in only, and only when rows exist.
  const continueReading: ContentSummary[] | undefined = isAuthenticated
    ? myHome?.continueReading
    : undefined;

  const feedItems = tab === "recommend" ? recommendations : following;
  const feedStatus: SectionStatus =
    homeStatus === "ready" ? (feedItems && feedItems.length > 0 ? "ready" : "empty") : homeStatus;

  const emptyText =
    tab === "recommend"
      ? "暂无推荐内容"
      : isAuthenticated
        ? "还没有关注更新，去发现看看"
        : "登录后可见关注动态";

  const announcementSection = {
    status: contentStatus(announcements, announcements.data ?? undefined),
    items: announcements.data ?? [],
  };
  const topicSection = {
    status: contentStatus(topics, topics.data ?? undefined),
    items: topics.data ?? [],
  };
  const eventSection = {
    status: contentStatus(events, events.data ?? undefined),
    items: events.data ?? [],
  };
  const creatorSection = { status: creators.status, items: creators.creators };

  const heroAnnouncement =
    announcementSection.status === "ready" && announcementSection.items[0]
      ? (() => {
          const item = announcementSection.items[0];
          const detailHref = `/announcements/${encodeURIComponent(item.id)}`;
          return (
            <div className="flex items-center gap-2.5 border-t border-border/60 pt-3 text-sm">
              <Megaphone className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <Link
                to={detailHref}
                className="min-w-0 flex-1 truncate font-medium text-primary hover:text-accent"
              >
                {item.title}
              </Link>
              <Link
                to={detailHref}
                className="shrink-0 text-xs text-accent hover:underline"
              >
                查看详情 ›
              </Link>
            </div>
          );
        })()
      : null;

  const showSidebar = hasSidebarContent([
    topicSection,
    creatorSection,
    eventSection,
  ]);

  if (homeFatal) {
    return <PageState kind="error" />;
  }

  return (
    <div className="section-gap">
      <PageHero
        eyebrow="XINGYU COMMUNITY"
        title="把灵感，放进自己的星系"
        /*
         * The prototype asks for 「登录：简洁欢迎语，不占太多空间」 — a signed-in reader gets
         * a greeting, not a second marketing pitch. `compact` drops the artwork and the height
         * so the feed starts higher up the page.
         */
        compact={isAuthenticated}
        immersive={!isAuthenticated}
        announcement={heroAnnouncement}
        description={
          isAuthenticated
            ? "欢迎回来，继续探索你的关注、阅读与创作。"
            : "在这里发现优质的内容，认识同频的人，慢慢建立自己的轨道。"
        }
        illustration={<HomeHeroArt />}
        actions={
          isAuthenticated ? null : (
            <>
              <Link to="/register" className={cn(buttonVariants({ variant: "accent" }), "gap-1.5")}>
                <Sparkles className="h-4 w-4" aria-hidden />
                加入星语
              </Link>
              <Link to="/login" className={buttonVariants({ variant: "outline" })}>
                登录
              </Link>
            </>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column — the feed itself. Full width when the rail has nothing. */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4",
            showSidebar ? "md:col-span-1" : "md:col-span-2",
          )}
        >
          <HomeFeedTabs
            value={tab}
            onChange={setTab}
            /*
             * 查看更多 only on 推荐, and only to /discover. There is no "more
             * following" page — /me/following is the follow GRAPH, not a feed —
             * so the 关注 tab gets no link rather than a link to the wrong place.
             */
            trailing={
              tab === "recommend" ? (
                <Link to="/discover" className="text-accent hover:underline">
                  查看更多推荐 ›
                </Link>
              ) : null
            }
          />

          {continueReading && continueReading.length > 0 ? (
            <ContinueReadingStrip items={continueReading} />
          ) : null}

          <section
            id={`home-tabpanel-${tab}`}
            role="tabpanel"
            aria-labelledby={`home-tab-${tab}`}
            className={cn(
              feedStatus === "ready" &&
                "rounded-xl border border-border/70 bg-card px-5 shadow-none sm:px-6",
            )}
          >
            <SectionState status={feedStatus} emptyText={emptyText}>
              <ul className="flex flex-col">
                {(feedItems ?? []).map((item) => (
                  <li key={item.id} className="border-b border-border/70 last:border-b-0">
                    <HomeFeedItem item={item} />
                  </li>
                ))}
              </ul>
            </SectionState>
          </section>
        </div>

        {/* Right column — community rail. */}
        <HomeSidebar
          topics={topicSection}
          creators={creatorSection}
          events={eventSection}
          signedIn={isAuthenticated}
          followError={creators.followError}
          pendingUsername={creators.pendingUsername}
          onToggleFollow={(creator) => void creators.toggleFollow(creator)}
        />
      </div>
    </div>
  );
}
