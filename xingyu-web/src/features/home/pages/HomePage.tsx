import { useEffect, useState } from "react";
import { homeApi } from "@/api/home/home.api";
import type { GuestHomeView, MeHomeView } from "@/api/home/home.types";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { eventsApi } from "@/api/events/events.api";
import type { EventView } from "@/api/events/events.types";
import type { AnnouncementSummary, ContentSummary } from "@/api/common.types";
import { useAuth } from "@/features/auth/auth.store";
import { type SectionStatus } from "@/components/shared/SectionState";
import { PageState } from "@/components/shared/PageState";
import { ArchetypeFrame } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";
import { HomeFeedTabs, type HomeFeedTab } from "@/features/home/components/HomeFeedTabs";
import { HomeFeedItem } from "@/features/home/components/HomeFeedItem";
import { ContinueReadingStrip } from "@/features/home/components/ContinueReadingStrip";
import { HomeSidebar, hasSidebarContent } from "@/features/home/components/HomeSidebar";
import { HomeNotice } from "@/features/home/components/HomeNotice";
import { EVENT_LIMIT } from "@/features/home/components/CommunityEventsPanel";
import { useRecommendedCreators } from "@/features/home/use-recommended-creators";
import {
  HomeFeedSkeleton,
  HomeSidebarSkeleton,
  ContinueReadingSkeleton,
} from "@/features/home/components/HomeFeedSkeleton";
import { EmptyFeedState } from "@/features/home/components/EmptyFeedState";
import { EnhancedHero } from "@/features/home/components/EnhancedHero";

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
  /*
   * Only `initializing` means "the stored token has not been resolved yet, so we
   * do not know which composition to ask for". `unauthenticated` and `error`
   * both have a usable answer for this page — there is no identity to render.
   * `error` in particular is the A2 retryable state (network/5xx during restore,
   * token kept); gating it out left the feed skeleton spinning forever instead
   * of falling back to the guest home. The guard still hides protected pages.
   */
  const ready = authStatus !== "initializing";

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

  // 空状态变体：根据 tab 和登录状态决定
  const emptyVariant =
    tab === "recommend" ? "recommend" : isAuthenticated ? "following-empty" : "following-guest";

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

  /*
   * SK6 信息流 · H 线 / D 紧 / R 错（A §3 的 Home 行）。
   *
   * 骨架交给 `ArchetypeFrame`，页面只声明身份，不再自己写栅格：
   *   skeleton="SK6"    → `[1fr 行式流 | 300 右栏]`，右栏由 `SectionRail` 粘住；
   *                       原来的 `lg:grid-cols-[minmax(0,1fr)_300px]` 与
   *                       `lg:sticky lg:top-[92px]` 两处手写栅格就此收敛。
   *   header="line"     → H=线：无面报头。首页报头仍是 `EnhancedHero` —— 它已是
   *                       线式报头（无卡片、无边框、标题贴内容列左缘、两个入口在
   *                       文字尾），并且是首屏唯一的视觉锚点（星空素材，B §7 R8）。
   *                       换成 `PageMasthead` 会丢掉这块锚点，也会改掉四条测试
   *                       钉住的文案结构，所以这里用它承担线式报头。
   *   density="compact" → D=紧：条目是「行」不是「格」，行与行靠发丝线分隔；行内
   *                       元信息在行**底**（作者 · 类型 + 互动计数），缩略图只在有
   *                       真实封面时出现。同为 SK6 的 TopicDetail 把元信息放在行
   *                       **首**且没有互动条 —— 两页靠条目内部结构区分，不靠配色。
   *   R=错             → 主列 + 300 右栏（热门话题 / 推荐创作者 / 社区活动）。
   *                       右栏空时整列不渲染，frame 退回单列（`SOLO.SK6`），不会有
   *                       一条与 feed 等高的空白竖栏。
   *
   * 游客可读性：`authStatus` 未定时（`initializing`）两个 composition 请求都不发（`ready`
   * 守卫）；`error`（恢复会话遇网络/5xx，token 仍保留）按游客态加载，不能停在骨架。
   * 报头只按 `isAuthenticated` 换文案与入口，全程没有登录态断言。
   */
  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={<EnhancedHero isAuthenticated={isAuthenticated} />}
      rail={
        showSidebar ? (
          homeStatus === "loading" ? (
            <HomeSidebarSkeleton />
          ) : (
            <HomeSidebar
              topics={topicSection}
              creators={creatorSection}
              events={eventSection}
              signedIn={isAuthenticated}
              followError={creators.followError}
              pendingUsername={creators.pendingUsername}
              onToggleFollow={(creator) => void creators.toggleFollow(creator)}
            />
          )
        ) : null
      }
      /* landmark 名与三块面板标题不同名，否则「热门话题」会在无障碍树里出现两次。 */
      railLabel="社区侧栏"
    >
      {/* 公告条：时效性信息，报头和内容区之间 */}
      {notice ? <HomeNotice item={notice} /> : null}

      {/*
        「标签页 / 继续阅读 / feed」是同一块功能区，内部间距保持 20px；与 frame
        给出的区块间距（density-compact = 32px）分开，不让标签和它自己的列表被
        一个「区块间距」隔开。
      */}
      <div className="flex min-w-0 flex-col gap-5">
        <HomeFeedTabs value={tab} onChange={setTab} />

        {/* 继续阅读 - 显示骨架屏或实际内容 */}
        {homeStatus === "loading" && isAuthenticated ? (
          <ContinueReadingSkeleton />
        ) : continueReading && continueReading.length > 0 ? (
          <ContinueReadingStrip items={continueReading} />
        ) : null}

        {/* Feed 内容区 - 加载态/空状态/实际内容 */}
        <section
          key={tab}
          id={`home-tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`home-tab-${tab}`}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {feedStatus === "loading" ? (
            <HomeFeedSkeleton count={3} />
          ) : feedStatus === "empty" ? (
            <div className="animate-in fade-in zoom-in-95 duration-300 delay-75">
              <EmptyFeedState variant={emptyVariant} />
            </div>
          ) : feedStatus === "error" ? (
            <div className="animate-in fade-in zoom-in-95 duration-300 delay-75">
              <div className="rounded-control border border-border/80 bg-card p-6 text-center">
                <p className="text-body font-medium text-danger">加载失败</p>
                <p className="mt-1 text-body text-foreground-soft">请稍后重试</p>
              </div>
            </div>
          ) : (
            // Rows, not a card. A 2xl bordered card wrapping a list made the
            // feed read as one object and pushed the section's edge 24px past
            // every other block on the page; a single hairline above the first
            // row is enough to separate it from the tabs, and each row's own
            // hover wash now spans the full column instead of being clipped by
            // `overflow-hidden`.
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 border-t border-border/70">
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
              <ul key={tab} className="flex flex-col">
                {(feedItems ?? []).map((item, index) => (
                  <li
                    key={item.id}
                    className={cn("animate-rise-in", index > 0 && "border-t border-border/50")}
                    style={{ animationDelay: staggerDelay(index) }}
                  >
                    <HomeFeedItem
                      item={item}
                      variant={tab === "recommend" ? "discover" : "subscription"}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </ArchetypeFrame>
  );
}
