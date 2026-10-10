import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HomeFeedTabs, type HomeFeedTab } from "@/features/home/components/HomeFeedTabs";
import { HomeFeedItem } from "@/features/home/components/HomeFeedItem";
import { ContinueReadingStrip } from "@/features/home/components/ContinueReadingStrip";
import { HomeSidebar, hasSidebarContent } from "@/features/home/components/HomeSidebar";
import { HomeMasthead } from "@/features/home/components/HomeMasthead";
import { HomeNotice } from "@/features/home/components/HomeNotice";
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
 *   HomeMasthead      (guest: 加入星语 / 登录)
 *   ├── left  (2/3)   HomeFeedTabs (推荐 / 关注 + 查看更多)
 *   │                 → ContinueReadingStrip → feed rows
 *   └── right (1/3)   HomeSidebar (热门话题 · 推荐创作者 · 社区活动)
 *
 * Every non-critical section degrades independently: a failing endpoint shows an
 * error inside that section only (never a blank page), and the home-specific
 * rule for non-critical modules is "empty means invisible" (see HomeSidebar).
 *
 * 2026-10-04 (A0): the opening block is HomeMasthead, not PageHero. See that
 * component for why — short version: a banner card with an illustration slot is
 * wrong for a page whose first screen has to hand the reader to a feed.
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
  /*
   * Fetch a little more than the rail renders. The server list is ordered by
   * `starts_at DESC` with no notion of ended-ness, and an ended event can sit at
   * the top of that order. Asking for exactly EVENT_LIMIT would leave the rail
   * nothing to filter with, so a live event could be pushed out by ended ones.
   * The panel does the ended-demotion; this over-fetch is what makes it possible.
   */
  const events = useSection<EventView[]>(() => eventsApi.list(EVENT_LIMIT + 4), [ready]);
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

  /*
   * The newest announcement, or null.
   *
   * Announcements are time-sensitive, so the rail is the wrong place for them —
   * on a narrow screen the rail stacks BELOW the whole feed and a notice down
   * there is a notice nobody reads. It is rendered as one plain line between the
   * masthead and the tabs instead, and only when it exists: with no announcement
   * the page gains no height and no empty box. See HomeNotice.
   */
  const notice =
    announcementSection.status === "ready" && announcementSection.items[0]
      ? announcementSection.items[0]
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
      {/*
       * A0: the home page left PageHero.
       *
       * PageHero is a BANNER — a bordered card with a left text column and a right
       * illustration slot. Measured on this page that produced a 448px text column
       * (the max-content width of one sentence, not a designed value), a 377px hole
       * between that column and the artwork, and a card border that made the banner
       * a second white surface stacked above the feed panel.
       *
       * `PageHero` itself is NOT touched: the other six top-level pages, /discover's
       * DiscoverHero and /creators all still use it. Only Home opts out, because
       * only Home's first screen has to hand the reader straight to a feed.
       */}
      <HomeMasthead
        eyebrow={isAuthenticated ? undefined : "XINGYU COMMUNITY"}
        title={
          isAuthenticated ? "欢迎回来，继续探索你的关注、阅读与创作。" : "把灵感，放进自己的星系"
        }
        /*
         * The prototype asks for 「登录：简洁欢迎语，不占太多空间」. That is now
         * expressed by CONTENT rather than by a compact mode: a returning reader gets
         * a one-line greeting and no pitch, so the block is shorter because there is
         * less in it — not because a flag halves its padding.
         */
        description={
          isAuthenticated
            ? undefined
            : "在这里发现优质的内容，认识同频的人，慢慢建立自己的轨道。"
        }
        actions={
          isAuthenticated ? undefined : (
            /*
             * ONE guest CTA, not two.
             *
             * 登录 used to sit here as well, but the shell header already carries a
             * 登录 entry on every route — two 登录 affordances in the same first
             * screen is one action offered twice. The masthead keeps only the gold
             * primary CTA; signing in is the header's job.
             */
            <Link to="/register" className={cn(buttonVariants({ variant: "accent" }), "gap-1.5")}>
              <Sparkles className="h-4 w-4" aria-hidden />
              加入星语
            </Link>
          )
        }
      />

      {notice ? <HomeNotice item={notice} /> : null}

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
             *
             * `text-accent-strong`, not `text-accent`: this is a TEXT link at 12px
             * on the page background, and raw brand gold measures 2.01:1 there
             * while accent-strong measures 4.72:1.
             */
            trailing={
              tab === "recommend" ? (
                <Link to="/discover" className="text-accent-strong hover:underline">
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
              /*
               * Note the two border opacities: the panel outline stays at /70 and
               * the row separators sit at /50. Before this they were the SAME
               * value, which meant the container outline and the dividers inside it
               * were literally the same line — the panel could not read as a
               * container because it was drawn with the same stroke as its
               * contents.
               */
              feedStatus === "ready" &&
                "rounded-xl border border-border/70 bg-card px-5 shadow-none sm:px-6",
            )}
          >
            <SectionState status={feedStatus} emptyText={emptyText}>
              <ul className="flex flex-col">
                {(feedItems ?? []).map((item) => (
                  <li key={item.id} className="border-b border-border/50 last:border-b-0">
                    {/*
                     * The two tabs are NOT the same feed with different data.
                     * 推荐 is a discovery feed and 关注 is a subscription feed, so
                     * the row's information hierarchy differs — see the variant
                     * doc comment in HomeFeedItem. They still share one row
                     * component and one interaction model on purpose.
                     */}
                    <HomeFeedItem
                      item={item}
                      variant={tab === "recommend" ? "discover" : "subscription"}
                    />
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
