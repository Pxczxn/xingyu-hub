"use client";

import styles from "./home-page.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Clock3,
  Compass,
  Layers,
  LoaderCircle,
  Megaphone,
  Orbit,
  RefreshCw,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentProfile } from "@/components/layout/current-profile-context";
import { resolveContentCoverUrl } from "@/lib/api-client";
import {
  contentHref,
  type AnnouncementSummary,
  type ContentSummary,
  type GalaxySummary,
  type SeriesSummary,
  type TopicSummary,
} from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import {
  HOME_MOCK_ANNOUNCEMENTS,
  HOME_MOCK_FOLLOW,
  HOME_MOCK_JOURNEY,
  HOME_MOCK_RECOMMENDATIONS,
  HOME_MOCK_TOPICS,
  withHomeMock,
} from "./home-page-mock-data";

type Props = {
  isGuest: boolean;
  loading: boolean;
  greetingLead: string;
  showUsernameChip?: boolean;
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

function SectionIcon({ icon: Icon, compact = false }: { icon: LucideIcon; compact?: boolean }) {
  return (
    <span className={cn(styles.sectionIcon, compact && styles.sectionIcon_sm)} aria-hidden="true">
      <Icon />
    </span>
  );
}

function SectionCard({
  icon: Icon,
  title,
  titleId,
  href,
  action,
  aside,
  compact = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  titleId: string;
  href?: string;
  action?: string;
  aside?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(styles.sectionCard, compact && styles.sectionCard_compact)}
      aria-labelledby={titleId}
    >
      <header className={styles.sectionCardHeader}>
        <div className={styles.sectionHeadLead}>
          <SectionIcon icon={Icon} compact={compact} />
          <h2 id={titleId} className={styles.sectionCardTitle}>{title}</h2>
        </div>
        {aside ?? (href && action ? (
          <Link href={href} className={styles.btnSecondary}>
            {action}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null)}
      </header>
      <div className={styles.sectionCardBody}>{children}</div>
    </section>
  );
}

function SectionHead({
  title,
  href,
  action,
  aside,
}: {
  title: string;
  href?: string;
  action?: string;
  aside?: ReactNode;
}) {
  return (
    <header className={styles.sectionHead}>
      <h2>{title}</h2>
      {aside ?? (href && action ? (
        <Link href={href} className={styles.btnSecondary}>
          {action}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null)}
    </header>
  );
}

function ContentThumb({
  item,
  size = "md",
  index = 0,
}: {
  item: ContentSummary;
  size?: "sm" | "md" | "lg";
  index?: number;
}) {
  const coverSrc = resolveContentCoverUrl(item.cover, item.id, index);
  return (
    <span className={cn(styles.thumb, size === "sm" ? styles.thumbSM : size === "lg" ? styles.thumbLG : styles.thumbMD)} aria-hidden="true">
      <img src={coverSrc} alt="" />
    </span>
  );
}

function FollowQuietEmpty() {
  return (
    <div className={styles.quietIllustrated} role="status">
      <div className={styles.quietIllustration} aria-hidden="true">
        <Activity />
      </div>
      <p>关注创作者后，他们的更新会出现在这里</p>
    </div>
  );
}

function AnnounceQuietEmpty() {
  return (
    <p className={styles.quietHint} role="status">
      暂无新公告 ·{" "}
      <Link href="/announcements">查看公告中心</Link>
    </p>
  );
}

export function HomePage({
  isGuest,
  loading,
  greetingLead,
  showUsernameChip = false,
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
  const [batch, setBatch] = useState(0);
  const [shortcutTab, setShortcutTab] = useState<ShortcutTab>("galaxy");

  const journey = withHomeMock(continueReading, HOME_MOCK_JOURNEY).slice(0, 4);
  const followItems = withHomeMock(followUpdates, HOME_MOCK_FOLLOW).slice(0, 4);
  const displayRecommendations = withHomeMock(recommendations, HOME_MOCK_RECOMMENDATIONS);
  const displayTopics = withHomeMock(topics, HOME_MOCK_TOPICS);
  const displayAnnouncements = withHomeMock(announcements, HOME_MOCK_ANNOUNCEMENTS);

  const rotatedRecommendations = useMemo(
    () => rotateItems(displayRecommendations, batch),
    [displayRecommendations, batch],
  );
  const discoverItems = rotatedRecommendations.slice(0, 5);
  const pickItems = rotatedRecommendations.slice(5, 9);
  const rotatedTopics = useMemo(() => rotateItems(displayTopics, batch), [displayTopics, batch]);
  const featuredTopic = rotatedTopics[0];
  const continueLead = journey[0];

  const trailHref = isGuest ? "/guide" : "/me/history";
  const trailLabel = isGuest ? "初来星语 · 阅读指南" : "查看阅读轨迹";
  const usingMockAnnouncements = announcements.length === 0;

  return (
    <main className={styles.homeHub} data-layout="home-hub" aria-busy={loading}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.greetingCard} aria-labelledby="home-greeting-title">
            <div className={styles.greetingCardInner}>
              <Avatar
                src={profile.avatar}
                fallback={avatarLabel}
                size="lg"
                className={styles.greetingAvatar}
                alt=""
              />
              <div className={styles.greetingCopy}>
                <h1 id="home-greeting-title" className={cn(styles.heading, styles.greetingTitle)}>
                  <span className={styles.headingText}>{greetingLead}</span>
                  {showUsernameChip ? (
                    <Link href={profileHref} className={styles.usernameChip} aria-label={`${avatarLabel} 的个人主页`}>
                      {username ? <span className={styles.usernameChipAt}>@</span> : null}
                      <span>{username || avatarLabel}</span>
                    </Link>
                  ) : null}
                </h1>
              </div>
            </div>
          </section>

          <section className={styles.continueStrip} aria-labelledby="home-continue-title">
            <div className={styles.continueStripLead}>
              <SectionIcon icon={Compass} compact />
              <h2 id="home-continue-title">继续探索</h2>
            </div>
            <div className={styles.continueStripMain}>
              {loading ? (
                <div className={styles.continueStripLoading} aria-label="正在加载继续探索">
                  <LoaderCircle className={cn("animate-spin")} />
                </div>
              ) : continueLead ? (
                <Link href={contentHref(continueLead)} className={styles.continueStripItem}>
                  <ContentThumb item={continueLead} size="sm" index={0} />
                  <span className={styles.continueStripCopy}>
                    <strong>{continueLead.title}</strong>
                    <small>{continueLead.summary || "继续上次未完成的内容"}</small>
                  </span>
                  <span className={styles.continueStripMeta}>
                    {typeof continueLead.readMinutes === "number" ? `${continueLead.readMinutes} min` : "继续"}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              ) : null}
            </div>
            <div className={styles.continueStripTrail}>
              <Link href={trailHref} className={styles.btnSecondary}>
                <Clock3 aria-hidden="true" />
                {trailLabel}
              </Link>
            </div>
          </section>

          <SectionCard
            icon={Activity}
            title="关注动态"
            titleId="home-follow-title"
            href={isGuest ? "/moments" : "/me/following"}
            action={isGuest ? "看看动态" : "管理关注"}
          >
            {loading ? (
              <div className={styles.sectionCardLoading} aria-label="正在加载关注动态">
                <LoaderCircle className={cn("animate-spin")} />
              </div>
            ) : followItems.length ? (
              <div className={styles.followGrid}>
                <Link href={contentHref(followItems[0])} className={styles.followFeature}>
                  <ContentThumb item={followItems[0]} size="lg" index={0} />
                  <span className={styles.followFeatureCopy}>
                    <strong>{followItems[0].authorName || "星语创作者"}</strong>
                    <b>{followItems[0].title}</b>
                    <small>{followItems[0].updatedAt ? formatDateTime(followItems[0].updatedAt) : "最近更新"}</small>
                  </span>
                </Link>
                <div className={styles.followStack}>
                  {followItems.slice(1).map((item, index) => (
                    <Link href={contentHref(item)} key={item.id} className={styles.followMini}>
                      <ContentThumb item={item} size="sm" index={index + 1} />
                      <span>
                        <strong>{item.authorName || "星语创作者"}</strong>
                        <small>{item.title}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <FollowQuietEmpty />
            )}
          </SectionCard>

          <section className={styles.sectionCard} aria-labelledby="home-discover-title">
            <header className={styles.sectionCardHeader}>
              <div className={styles.sectionHeadLead}>
                <SectionIcon icon={Sparkles} />
                <h2 id="home-discover-title" className={styles.sectionCardTitle}>为你发现</h2>
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                aria-label="换一批"
                onClick={() => setBatch((value) => value + 1)}
              >
                <RefreshCw aria-hidden="true" />
                换一批
              </button>
            </header>
            <div className={styles.sectionCardBody}>
              {loading ? (
                <div className={styles.sectionCardLoading} aria-label="正在加载推荐">
                  <LoaderCircle className={cn("animate-spin")} />
                </div>
              ) : (
                <ul className={styles.discoverList}>
                  {discoverItems.map((item, index) => (
                    <li key={item.id}>
                      <Link href={contentHref(item)} className={styles.discoverRow}>
                        <ContentThumb item={item} size="md" index={index} />
                        <span className={styles.discoverRowCopy}>
                          <span className={styles.discoverType}>
                            {item.objectType === "series" ? "系列" : "文章"}
                          </span>
                          <strong>{item.title}</strong>
                          <p>{item.summary || "来自星语社区的精选内容"}</p>
                          <small>
                            {item.authorName || "星语创作者"}
                            {item.readMinutes ? ` · ${item.readMinutes} min` : ""}
                          </small>
                        </span>
                        <ArrowRight className={styles.discoverRowArrow} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={styles.sectionCard} aria-labelledby="home-picks-title">
            <SectionHead title="内容精选" href="/discover" action="去探索" />
            <div className={styles.sectionCardBody}>
              {loading ? (
                <div className={styles.sectionCardLoading} aria-label="正在加载精选">
                  <LoaderCircle className={cn("animate-spin")} />
                </div>
              ) : (
                <ul className={styles.picksList}>
                  {pickItems.map((item, index) => (
                    <li key={item.id}>
                      <Link href={contentHref(item)} className={styles.picksRow}>
                        <ContentThumb item={item} size="sm" index={index + 5} />
                        <span className={styles.picksRowCopy}>
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
              )}
            </div>
          </section>
        </div>

        <aside className={styles.aside} aria-label="首页侧边信息">
          <SectionCard
            icon={Megaphone}
            title="星语公告"
            titleId="home-announce-title"
            href="/announcements"
            action="查看公告中心"
            compact
          >
            {loading ? (
              <div className={styles.sectionCardLoading} aria-label="正在加载公告">
                <LoaderCircle className={cn("animate-spin")} />
              </div>
            ) : announcements.length ? (
              <ul className={styles.announceList}>
                {announcements.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={`/announcements/${encodeURIComponent(item.id)}`}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.publishedAt ? formatDateTime(item.publishedAt) : "星语公告"}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : usingMockAnnouncements ? (
              <ul className={styles.announceList}>
                {displayAnnouncements.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <Link href="/announcements">
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.publishedAt ? formatDateTime(item.publishedAt) : "星语公告"}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <AnnounceQuietEmpty />
            )}
          </SectionCard>

          <SectionCard
            icon={Star}
            title="话题雷达"
            titleId="home-radar-title"
            href="/topics"
            action="浏览话题"
            compact
          >
            {loading ? (
              <div className={styles.sectionCardLoading} aria-label="正在加载话题">
                <LoaderCircle className={cn("animate-spin")} />
              </div>
            ) : featuredTopic ? (
              <div className={styles.radarBody}>
                <Link href={`/topics/${featuredTopic.slug}`} className={styles.featureTopic}>
                  <b>#{featuredTopic.name}</b>
                  <p>{featuredTopic.description || "正在升温的讨论方向"}</p>
                  <small>
                    {featuredTopic.contentCount ?? 0} 条内容 · {featuredTopic.followerCount ?? 0} 人关注
                  </small>
                </Link>
                <div className={styles.topicPills}>
                  {rotatedTopics.slice(1, 5).map((topic) => (
                    <Link href={`/topics/${topic.slug}`} key={topic.id}>
                      #{topic.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <section className={styles.sectionCard} aria-labelledby="home-mine-title">
            <header className={styles.sectionCardHeader}>
              <div className={styles.sectionHeadLead}>
                <SectionIcon icon={Orbit} compact />
                <h2 id="home-mine-title" className={styles.sectionCardTitle}>我的创作与星系</h2>
              </div>
              <Link
                href={shortcutTab === "galaxy" ? (isGuest ? "/galaxies" : "/me/galaxies") : (isGuest ? "/login" : "/studio/series")}
                className={styles.btnSecondary}
              >
                {shortcutTab === "galaxy" ? "探索星系" : "管理系列"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </header>
            <div className={styles.sectionCardBody}>
              <div className={styles.tabs} role="tablist" aria-label="创作与星系切换">
                <button
                  type="button"
                  role="tab"
                  aria-selected={shortcutTab === "galaxy"}
                  className={shortcutTab === "galaxy" ? styles.isActive : undefined}
                  onClick={() => setShortcutTab("galaxy")}
                >
                  我的星系
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={shortcutTab === "series"}
                  className={shortcutTab === "series" ? styles.isActive : undefined}
                  onClick={() => setShortcutTab("series")}
                >
                  我的系列
                </button>
              </div>
              {loading ? (
                <div className={styles.sectionCardLoading} aria-label="正在加载">
                  <LoaderCircle className={cn("animate-spin")} />
                </div>
              ) : shortcutTab === "galaxy" ? (
                galaxies.length ? (
                  <ul className={styles.shortcutList}>
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
                  <div className={styles.shortcutEmpty}>
                    <p>还没有加入星系</p>
                    <Link href="/galaxies" className={styles.btnPrimary}>探索星系</Link>
                  </div>
                )
              ) : series.length ? (
                <ul className={styles.shortcutList}>
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
                <div className={styles.shortcutEmpty}>
                  <p>{isGuest ? "登录后管理你的系列" : "还没有创建系列"}</p>
                  <Link href={isGuest ? "/login" : "/studio/series/new"} className={styles.btnPrimary}>
                    {isGuest ? "登录创作" : "创建系列"}
                  </Link>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
