import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Pencil } from "lucide-react";
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
import { PageMasthead } from "@/components/shared/PageMasthead";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";
import { HomeFeedTabs, type HomeFeedTab } from "@/features/home/components/HomeFeedTabs";
import { HomeFeedItem } from "@/features/home/components/HomeFeedItem";
import { ContinueReadingStrip } from "@/features/home/components/ContinueReadingStrip";
import { HomeSidebar, hasSidebarContent } from "@/features/home/components/HomeSidebar";
import { HomeNotice } from "@/features/home/components/HomeNotice";
import { EVENT_LIMIT } from "@/features/home/components/CommunityEventsPanel";
import { useRecommendedCreators } from "@/features/home/use-recommended-creators";

/*
 * Home — 社区入口与内容发现
 *
 * 阶段一 MVP（2026-10-14）：
 *
 * 信息架构：
 *
 *   PageMasthead          Hero 区（新文案：探索内容 + 开始创作）
 *   HomeNotice            公告条（如果有）
 *   ├── left  (2/3)       主 Feed 区
 *   │   ├── HomeFeedTabs      推荐 / 关注
 *   │   ├── ContinueReading   继续阅读（仅登录）
 *   │   └── Feed Items        内容列表
 *   └── right (1/3)       社区导航
 *       ├── TrendingTopics        热门话题
 *       ├── RecommendedCreators   推荐创作者
 *       └── CommunityEvents       社区活动
 *
 * 改动：
 *  1. Hero 文案改为更社区化的表达
 *  2. Guest 提供两个入口：探索内容（主）+ 开始创作（次）
 *  3. 保持内容 Feed 为核心
 *
 * 未启用的功能（等数据验证后再考虑）：
 *  - 星系入口区（需要星系活跃度数据）
 *  - 今日精选（需要内容运营团队）
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
  /* Bumping the key replays the page's load effects — the retry mechanism for
     the error branch below. The effects keep their per-run `active` guards. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [ready, isAuthenticated, reloadKey]);

  // Non-critical rail modules, isolated so failures cannot blank the page.
  const announcements = useSection<AnnouncementSummary[]>(
    () => homeApi.getAnnouncements(3),
    [ready, reloadKey],
  );
  const topics = useSection<TopicSummary[]>(() => topicsApi.getTopics(), [ready, reloadKey]);
  /*
   * Fetch a little more than the rail renders. The server list is ordered by
   * `starts_at DESC` with no notion of ended-ness, and an ended event can sit at
   * the top of that order. Asking for exactly EVENT_LIMIT would leave the rail
   * nothing to filter with, so a live event could be pushed out by ended ones.
   * The panel does the ended-demotion; this over-fetch is what makes it possible.
   */
  const events = useSection<EventView[]>(() => eventsApi.list(EVENT_LIMIT + 4), [ready, reloadKey]);
  const creators = useRecommendedCreators(ready, isAuthenticated, reloadKey);

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
        ? "还没有关注动态"
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
   * 公告：最新一条
   *
   * 时效性信息，放在 masthead 和内容区之间。
   * 移动端也可见（侧边栏会堆到下方）。
   */
  const notice =
    announcementSection.status === "ready" && announcementSection.items[0]
      ? announcementSection.items[0]
      : null;

  const showSidebar = hasSidebarContent([topicSection, creatorSection, eventSection]);

  if (homeFatal) {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">
      {/*
       * 第一刀：Hero 改
       *
       * 原文案像官网宣传页，改为更贴近创作与探索的语气。
       *
       * Guest:
       *   标题："让想法，汇聚成自己的星系"
       *   副标题："记录探索，分享成长，找到与你同行的人。"
       *   按钮：[探索内容] [开始创作]
       *
       * Member:
       *   简洁欢迎语，无按钮（shell header 已有入口）
       */}
      <PageMasthead
        variant={isAuthenticated ? "default" : "featured"}
        eyebrow={isAuthenticated ? undefined : undefined}
        title={
          isAuthenticated
            ? "欢迎回来"
            : "欢迎来到星语 ✦"
        }
        description={isAuthenticated ? "继续探索你的关注与创作。" : "从一篇内容开始，探索属于你的星语"}
        actions={
          isAuthenticated ? undefined : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/discover"
                className={cn(
                  buttonVariants({ variant: "accent", size: "lg" }),
                  "group relative gap-2 overflow-hidden shadow-md transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg active:scale-100",
                )}
              >
                <Compass className="h-5 w-5 transition-transform group-hover:rotate-12" aria-hidden />
                <span className="relative z-10">探索内容</span>
                {/* 悬浮光效 */}
                <span
                  className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/register"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "group gap-2 transition-all duration-200",
                  "hover:scale-105 hover:border-accent/50 hover:bg-accent/5 active:scale-100",
                )}
              >
                <Pencil className="h-5 w-5 transition-transform group-hover:-rotate-12" aria-hidden />
                开始创作
              </Link>
            </div>
          )
        }
      />

      {/* 公告条：时效性信息，Hero 和内容区之间 */}
      {notice ? <HomeNotice item={notice} /> : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* 左列 — 主 Feed 区 */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4",
            showSidebar ? "md:col-span-1" : "md:col-span-2",
          )}
        >
          <HomeFeedTabs
            value={tab}
            onChange={setTab}
            trailing={
              tab === "recommend" ? (
                <Link
                  to="/discover"
                  className="group inline-flex items-center gap-1 text-accent-strong transition-all duration-200 hover:gap-1.5 hover:underline"
                >
                  <span>查看更多推荐</span>
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                    ›
                  </span>
                </Link>
              ) : null
            }
          />

          {continueReading && continueReading.length > 0 ? (
            <ContinueReadingStrip items={continueReading} />
          ) : null}

          <section
            key={tab}
            id={`home-tabpanel-${tab}`}
            role="tabpanel"
            aria-labelledby={`home-tab-${tab}`}
            className={cn(
              "animate-in fade-in slide-in-from-bottom-4 duration-300",
              feedStatus === "ready" &&
                "rounded-2xl border border-border/70 bg-card px-5 shadow-sm sm:px-6",
            )}
          >
            <SectionState status={feedStatus} emptyText={emptyText}>
              {/*
               * 第四刀：Feed 内容卡增强
               *
               * 增加所属系列/星系/话题信息，让它不像博客列表。
               * 数据契约不变，只在已有字段上增强展示。
               *
               * 精选与 Feed 关系：
               * - 精选是推荐第一条的"强化展示"，不是替代
               * - Feed 列表保持完整，包含第一条
               * - 这样测试不需要调整，用户体验也更好（Feed 可独立滚动）
               */}
              <ul key={tab} className="flex flex-col gap-2">
                {(feedItems ?? []).map((item, index) => (
                  <li
                    key={item.id}
                    className="animate-rise-in"
                    style={{ animationDelay: staggerDelay(index) }}
                  >
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

        {/*
         * 第五刀：右侧栏顺序调整
         *
         * 原顺序：热门话题 > 推荐创作者 > 社区活动
         * 新顺序：探索星系 > 热门话题 > 活跃创作者
         *
         * 为什么：星系是星语特色，应该优先展示。
         *
         * 注意：这里的"探索星系"是 HomeSidebar 内部的模块，
         * 不是上方的 GalaxyExploreEntries。
         */}
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
