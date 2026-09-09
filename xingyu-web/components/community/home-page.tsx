"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock3,
  Layers,
  LoaderCircle,
  Megaphone,
  Orbit,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentProfile } from "@/components/layout/current-profile-context";
import {
  contentHref,
  type AnnouncementSummary,
  type ContentSummary,
  type GalaxySummary,
  type SeriesSummary,
  type TopicSummary,
} from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

type Props = {
  isGuest: boolean;
  loading: boolean;
  greetingLead: string;
  showUsernameChip?: boolean;
  greetingMeta?: string | null;
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  topics: TopicSummary[];
  announcements: AnnouncementSummary[];
  galaxies: GalaxySummary[];
  series: SeriesSummary[];
};

type ShortcutTab = "galaxy" | "series";

function rotateItems<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const start = offset % items.length;
  return items.slice(start).concat(items.slice(0, start));
}

function SectionHead({
  title,
  subtitle,
  href,
  action,
  aside,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  action?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="xy-home-hub-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {aside ?? (href && action ? (
        <Link href={href}>
          {action}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null)}
    </header>
  );
}

function AsidePanelHead({
  title,
  subtitle,
  href,
  action,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  action?: string;
}) {
  return (
    <header className="xy-home-hub-aside-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {href && action ? (
        <Link href={href}>
          {action}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </header>
  );
}

function ContentThumb({ item, size = "md" }: { item: ContentSummary; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`xy-home-hub-thumb xy-home-hub-thumb--${size}`} aria-hidden="true">
      {item.cover ? <img src={item.cover} alt="" /> : <BookOpen />}
    </span>
  );
}

export function HomePage({
  isGuest,
  loading,
  greetingLead,
  showUsernameChip = false,
  greetingMeta,
  continueReading,
  followUpdates,
  recommendations,
  topics,
  announcements,
  galaxies,
  series,
}: Props) {
  const profile = useCurrentProfile();
  const avatarLabel = profile.displayName || profile.username || "星语";
  const username = profile.username;
  const profileHref = username ? `/u/${username}` : "/me";
  const [greetingCollapsed, setGreetingCollapsed] = useState(false);
  const [batch, setBatch] = useState(0);
  const [shortcutTab, setShortcutTab] = useState<ShortcutTab>("galaxy");

  const journey = continueReading.slice(0, 4);
  const followItems = followUpdates.slice(0, 4);
  const rotatedRecommendations = useMemo(
    () => rotateItems(recommendations, batch),
    [recommendations, batch],
  );
  const discoverItems = rotatedRecommendations.slice(0, 5);
  const pickItems = rotatedRecommendations.slice(5, 9);
  const rotatedTopics = useMemo(() => rotateItems(topics, batch), [topics, batch]);
  const featuredTopic = rotatedTopics[0];

  const subtitle =
    greetingMeta ||
    (isGuest ? "从一篇内容开始，慢慢认识星语社区" : "从一篇内容开始，探索属于你的星语。");

  const trailHref = isGuest ? "/guide" : "/me/history";
  const trailLabel = isGuest ? "初来星语 · 阅读指南" : "查看阅读轨迹";

  return (
    <main className="xy-home-hub" aria-busy={loading}>
      <div className="xy-home-hub-layout">
        <div className="xy-home-hub-main">
          <section
            className={`xy-home-hub-greeting${greetingCollapsed ? " is-collapsed" : ""}`}
            aria-labelledby="home-greeting-title"
          >
            <Avatar
              src={profile.avatar}
              fallback={avatarLabel}
              size="lg"
              className="xy-home-hub-greeting-avatar"
              alt=""
            />
            <div className="xy-home-hub-greeting-copy">
              <div className="xy-home-hub-greeting-row">
                <h1 id="home-greeting-title" className="xy-greeting-heading xy-home-hub-greeting-title">
                  <span className="xy-greeting-heading-text">{greetingLead}</span>
                  {showUsernameChip ? (
                    <Link href={profileHref} className="xy-username-chip" aria-label={`${avatarLabel} 的个人主页`}>
                      {username ? <span className="xy-username-chip-at">@</span> : null}
                      <span>{username || avatarLabel}</span>
                    </Link>
                  ) : null}
                  <span className="xy-greeting-spark" aria-hidden="true">✦</span>
                </h1>
                <button
                  type="button"
                  className="xy-home-hub-greeting-toggle"
                  aria-expanded={!greetingCollapsed}
                  aria-controls="home-greeting-details"
                  onClick={() => setGreetingCollapsed((value) => !value)}
                >
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>
              <div id="home-greeting-details" className="xy-home-hub-greeting-details">
                <p>{subtitle}</p>
              </div>
            </div>
          </section>

          <section className="xy-home-hub-continue" aria-labelledby="home-continue-title">
            <SectionHead
              title="继续探索"
              aside={
                <Link href={trailHref} className="xy-home-hub-trail-link">
                  <Clock3 aria-hidden="true" />
                  {trailLabel}
                </Link>
              }
            />
            {loading ? (
              <div className="xy-home-hub-continue-banner is-loading" aria-label="正在加载继续探索">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : journey.length ? (
              <div className="xy-home-hub-continue-scroll">
                {journey.map((item, index) => (
                  <Link href={contentHref(item)} key={item.id} className="xy-home-hub-continue-banner">
                    <span className={`xy-home-hub-continue-icon kind-${index % 4}`} aria-hidden="true">
                      <BookOpen />
                    </span>
                    <span className="xy-home-hub-continue-copy">
                      <strong>{item.title}</strong>
                      <small>{item.summary || "继续上次未完成的内容"}</small>
                    </span>
                    <span className="xy-home-hub-continue-meta">
                      {typeof item.readMinutes === "number" ? `${item.readMinutes} min` : "继续"}
                      <ArrowRight aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="xy-home-hub-continue-banner is-empty" role="status">
                <span className="xy-home-hub-continue-icon kind-0" aria-hidden="true">
                  <BookOpen />
                </span>
                <div className="xy-home-hub-continue-empty-copy">
                  <p>{isGuest ? "登录后保存你的阅读、话题与系列进度" : "暂时没有进行中的内容"}</p>
                  <Link href={isGuest ? "/login" : "/discover"}>
                    {isGuest ? "登录后继续探索" : "去探索"}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="xy-home-hub-follow" aria-labelledby="home-follow-title">
            <SectionHead
              title="关注动态"
              href={isGuest ? "/moments" : "/me/following"}
              action={isGuest ? "看看动态" : "管理关注"}
            />
            {loading ? (
              <div className="xy-home-hub-follow-grid is-loading" aria-label="正在加载关注动态">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : followItems.length ? (
              <div className="xy-home-hub-follow-grid">
                <Link href={contentHref(followItems[0])} className="xy-home-hub-follow-feature">
                  <ContentThumb item={followItems[0]} size="lg" />
                  <span className="xy-home-hub-follow-feature-copy">
                    <strong>{followItems[0].authorName || "星语创作者"}</strong>
                    <b>{followItems[0].title}</b>
                    <small>{followItems[0].updatedAt ? formatDateTime(followItems[0].updatedAt) : "最近更新"}</small>
                  </span>
                </Link>
                <div className="xy-home-hub-follow-stack">
                  {followItems.slice(1).map((item) => (
                    <Link href={contentHref(item)} key={item.id} className="xy-home-hub-follow-mini">
                      <ContentThumb item={item} size="sm" />
                      <span>
                        <strong>{item.authorName || "星语创作者"}</strong>
                        <small>{item.title}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="xy-home-hub-follow-empty" role="status">
                <UserRound aria-hidden="true" />
                <p>暂时没有新的关注动态</p>
                <Link href={isGuest ? "/moments" : "/me/following"}>
                  {isGuest ? "看看动态" : "管理关注"}
                </Link>
              </div>
            )}
          </section>

          <section className="xy-home-hub-discover" aria-labelledby="home-discover-title">
            <header className="xy-home-hub-discover-head">
              <div>
                <h2 id="home-discover-title">为你发现</h2>
                <p>从正在发生的内容里，找到下一篇值得读的故事</p>
              </div>
              <button
                type="button"
                className="xy-home-hub-refresh"
                aria-label="换一批"
                onClick={() => setBatch((value) => value + 1)}
              >
                <RefreshCw aria-hidden="true" />
                换一批
              </button>
            </header>
            <div className="xy-home-hub-discover-stage">
              {loading ? (
                <div className="xy-home-hub-discover-loading" aria-label="正在加载推荐">
                  <LoaderCircle className="animate-spin" />
                  正在为你挑选内容
                </div>
              ) : discoverItems.length ? (
                <ul className="xy-home-hub-discover-list">
                  {discoverItems.map((item) => (
                    <li key={item.id}>
                      <Link href={contentHref(item)} className="xy-home-hub-discover-row">
                        <ContentThumb item={item} size="md" />
                        <span className="xy-home-hub-discover-row-copy">
                          <span className="xy-home-hub-discover-type">
                            {item.objectType === "series" ? "系列" : "文章"}
                          </span>
                          <strong>{item.title}</strong>
                          <p>{item.summary || "来自星语社区的精选内容"}</p>
                          <small>
                            {item.authorName || "星语创作者"}
                            {item.readMinutes ? ` · ${item.readMinutes} min` : ""}
                          </small>
                        </span>
                        <ArrowRight className="xy-home-hub-discover-row-arrow" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="xy-home-hub-discover-empty" role="status">
                  <p>暂时没有推荐内容</p>
                  <Link href="/discover">去探索 <ArrowRight aria-hidden="true" /></Link>
                </div>
              )}
            </div>
          </section>

          <section className="xy-home-hub-picks" aria-labelledby="home-picks-title">
            <SectionHead title="内容精选" subtitle="编辑为你甄选的高质量内容" href="/discover" action="去探索" />
            {loading ? (
              <div className="xy-home-hub-picks-loading" aria-label="正在加载精选">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : pickItems.length ? (
              <ul className="xy-home-hub-picks-list">
                {pickItems.map((item) => (
                  <li key={item.id}>
                    <Link href={contentHref(item)} className="xy-home-hub-picks-row">
                      <ContentThumb item={item} size="sm" />
                      <span className="xy-home-hub-picks-row-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.authorName || "星语创作者"}
                          {item.readMinutes ? ` · ${item.readMinutes} min` : ""}
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="xy-home-hub-picks-empty" role="status">
                <Sparkles aria-hidden="true" />
                <p>暂时没有精选内容</p>
                <Link href="/discover">去探索</Link>
              </div>
            )}
          </section>
        </div>

        <aside className="xy-home-hub-aside" aria-label="首页侧边信息">
          <section className="xy-home-hub-aside-card xy-home-hub-announce" aria-labelledby="home-announce-title">
            <AsidePanelHead title="星语公告" href="/announcements" action="查看公告中心" />
            {loading ? (
              <div className="xy-home-hub-aside-loading" aria-label="正在加载公告">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : announcements.length ? (
              <ul className="xy-home-hub-announce-list">
                {announcements.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={`/announcements/${encodeURIComponent(item.id)}`}>
                      <Megaphone aria-hidden="true" />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.publishedAt ? formatDateTime(item.publishedAt) : "星语公告"}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="xy-home-hub-announce-empty" role="status">
                <Megaphone aria-hidden="true" />
                <p>暂时没有新公告</p>
                <Link href="/announcements">查看公告中心</Link>
              </div>
            )}
          </section>

          <section className="xy-home-hub-aside-card xy-home-hub-radar" aria-labelledby="home-radar-title">
            <AsidePanelHead title="话题雷达" subtitle="看看大家正在讨论什么" href="/topics" action="浏览话题" />
            {loading ? (
              <div className="xy-home-hub-aside-loading" aria-label="正在加载话题">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : featuredTopic ? (
              <div className="xy-home-hub-radar-body">
                <Link href={`/topics/${featuredTopic.slug}`} className="xy-home-hub-feature-topic">
                  <Star aria-hidden="true" />
                  <b>#{featuredTopic.name}</b>
                  <p>{featuredTopic.description || "正在升温的讨论方向"}</p>
                  <small>
                    {featuredTopic.contentCount ?? 0} 条内容 · {featuredTopic.followerCount ?? 0} 人关注
                  </small>
                </Link>
                <div className="xy-home-hub-topic-pills">
                  {rotatedTopics.slice(1, 5).map((topic) => (
                    <Link href={`/topics/${topic.slug}`} key={topic.id}>
                      # {topic.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="xy-home-hub-announce-empty" role="status">
                <Star aria-hidden="true" />
                <p>暂无热门话题</p>
                <Link href="/topics">浏览话题</Link>
              </div>
            )}
          </section>

          <section className="xy-home-hub-aside-card xy-home-hub-mine" aria-labelledby="home-mine-title">
            <AsidePanelHead
              title="我的创作与星系"
              href={shortcutTab === "galaxy" ? (isGuest ? "/galaxies" : "/me/galaxies") : (isGuest ? "/login" : "/studio/series")}
              action={shortcutTab === "galaxy" ? "探索星系" : "管理系列"}
            />
            <div className="xy-home-hub-tabs" role="tablist" aria-label="创作与星系切换">
              <button
                type="button"
                role="tab"
                aria-selected={shortcutTab === "galaxy"}
                className={shortcutTab === "galaxy" ? "is-active" : undefined}
                onClick={() => setShortcutTab("galaxy")}
              >
                我的星系
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shortcutTab === "series"}
                className={shortcutTab === "series" ? "is-active" : undefined}
                onClick={() => setShortcutTab("series")}
              >
                我的系列
              </button>
            </div>
            {loading ? (
              <div className="xy-home-hub-aside-loading" aria-label="正在加载">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : shortcutTab === "galaxy" ? (
              galaxies.length ? (
                <ul className="xy-home-hub-shortcut-list">
                  {galaxies.slice(0, 4).map((galaxy) => (
                    <li key={galaxy.id}>
                      <Link href={`/galaxies/${galaxy.slug}`}>
                        <Orbit aria-hidden="true" />
                        <span>
                          <strong>{galaxy.name}</strong>
                          <small>{galaxy.memberCount == null ? "成员数量暂未公开" : `${galaxy.memberCount} 位成员`}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="xy-home-hub-shortcut-empty">
                  <p>还没有加入星系</p>
                  <small>找到长期关注同一方向的人，一起沉淀内容与成果。</small>
                  <Link href="/galaxies">探索星系</Link>
                </div>
              )
            ) : series.length ? (
              <ul className="xy-home-hub-shortcut-list">
                {series.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <Link href={`/series/${item.id}`}>
                      <Layers aria-hidden="true" />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.chapterCount ? `${item.chapterCount} 篇内容` : "系列内容"}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="xy-home-hub-shortcut-empty">
                <p>{isGuest ? "登录后管理你的系列" : "还没有创建系列"}</p>
                <small>把零散文章组织为持续阅读的主题。</small>
                <Link href={isGuest ? "/login" : "/studio/series/new"}>
                  {isGuest ? "登录创作" : "创建系列"}
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
