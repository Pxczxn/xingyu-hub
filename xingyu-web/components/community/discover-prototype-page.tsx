"use client";
import styles from "./discover-prototype-page.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Filter,
  Hash,
  Orbit,
  Settings2,
  Users,
} from "lucide-react";
import { FollowButton } from "@/components/community/engagement";
import { useCurrentProfile } from "@/components/layout/current-profile-context";
import { resolveContentCoverUrl } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  contentHref,
  type ContentSummary,
  type ExploreNav,
  type FollowUser,
  type GalaxySummary,
  type SeriesSummary,
  type TopicSummary,
} from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import {
  buildDiscoverMockStream,
  DISCOVER_MOCK_CREATORS,
  DISCOVER_MOCK_GALAXIES,
  withHomeMock,
} from "./discover-page-mock-data";

type DiscoverPrototypePageProps = {
  nav: ExploreNav;
  domainKey: string;
  sortKey: string;
  onFilterChange: (domainKey: string, sortKey: string) => void;
  articles: ContentSummary[];
  more: ContentSummary[];
  series: SeriesSummary[];
  topics: TopicSummary[];
  creators: FollowUser[];
  galaxies: GalaxySummary[];
};

type DiscoverStreamItem =
  | { key: string; kind: "article" | "moment"; item: ContentSummary }
  | { key: string; kind: "series"; item: SeriesSummary }
  | { key: string; kind: "topic"; item: TopicSummary };

const TYPE_LABELS: Record<DiscoverStreamItem["kind"], string> = {
  article: "文章",
  moment: "动态",
  series: "系列",
  topic: "话题",
};

function count(value?: number) {
  if (value === undefined) return "—";
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

function interleave<T>(...groups: T[][]): T[] {
  const result: T[] = [];
  let index = 0;

  while (true) {
    let added = false;
    for (const group of groups) {
      if (index < group.length) {
        result.push(group[index]);
        added = true;
      }
    }
    if (!added) break;
    index += 1;
  }

  return result;
}

function buildDiscoverStream(
  articles: ContentSummary[],
  more: ContentSummary[],
  series: SeriesSummary[],
  topics: TopicSummary[]
): DiscoverStreamItem[] {
  const articleItems: DiscoverStreamItem[] = articles.map((item) => ({
    key: `article-${item.id}`,
    kind: "article",
    item,
  }));
  const momentItems: DiscoverStreamItem[] = more.map((item) => ({
    key: `moment-${item.id}`,
    kind: "moment",
    item,
  }));
  const seriesItems: DiscoverStreamItem[] = series.slice(0, 4).map((item) => ({
    key: `series-${item.id}`,
    kind: "series",
    item,
  }));
  const topicItems: DiscoverStreamItem[] = [...topics]
    .sort((left, right) => (right.contentCount ?? 0) - (left.contentCount ?? 0))
    .slice(0, 4)
    .map((item) => ({
      key: `topic-${item.id}`,
      kind: "topic",
      item,
    }));

  return interleave(articleItems, seriesItems, topicItems, momentItems).slice(0, 14);
}

function SectionHead({
  title,
  href,
  action = "查看全部",
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className={cn(styles.sectionHead)}>
      <h2>{title}</h2>
      {href ? (
        <Link href={href} className={cn(styles.sectionLink)}>
          {action}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function StreamEmpty({ nav }: { nav: ExploreNav }) {
  return (
    <div className={cn(styles.streamEmpty)}>
      <p>
        {nav.mode === "user"
          ? "这个探索方向的内容还在汇集，试试切换其他方向或管理我的探索。"
          : "这个星域的内容还在汇集，可以先从其他官方领域开始。"}
      </p>
      <div className={cn(styles.streamEmptyLinks)}>
        {nav.canManage ? <Link href="/me/interests">管理我的探索</Link> : null}
        <Link href="/topics">逛逛话题</Link>
        <Link href="/galaxies">进入星域</Link>
      </div>
    </div>
  );
}

function StreamMeta({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className={styles.streamMeta}>{children}</div>;
}

function StreamItemRow({ entry, lead = false }: { entry: DiscoverStreamItem; lead?: boolean }) {
  if (entry.kind === "series") {
    const item = entry.item;
    const chapterLabel =
      item.chapterCount !== undefined ? `共 ${item.chapterCount} 篇` : "连载中";
    const hasMeta = Boolean(item.updatedAt);

    return (
      <li className={cn(styles.streamItem, lead && styles.streamItemLead)}>
        <Link href={`/series/${item.id}`} className={styles.streamLink}>
          <span className={styles.streamMark} aria-hidden="true">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className={styles.streamBody}>
            <span className={styles.streamType}>{TYPE_LABELS.series}</span>
            <strong className={styles.streamTitle}>{item.title}</strong>
          </div>
          <StreamMeta>
            <span>{chapterLabel}</span>
            {hasMeta ? <span>{formatDateTime(item.updatedAt!)}</span> : null}
          </StreamMeta>
        </Link>
      </li>
    );
  }

  if (entry.kind === "topic") {
    const item = entry.item;

    return (
      <li className={cn(styles.streamItem, lead && styles.streamItemLead)}>
        <Link href={`/topics/${item.slug}`} className={styles.streamLink}>
          <span className={styles.streamMark} aria-hidden="true">
            <Hash className="h-3.5 w-3.5" />
          </span>
          <div className={styles.streamBody}>
            <span className={styles.streamType}>{TYPE_LABELS.topic}</span>
            <strong className={styles.streamTitle}># {item.name}</strong>
          </div>
          <StreamMeta>
            <span>{count(item.contentCount)} 讨论</span>
          </StreamMeta>
        </Link>
      </li>
    );
  }

  const item = entry.item;
  const hasMeta = Boolean(item.readMinutes || item.updatedAt);

  return (
    <li className={cn(styles.streamItem, lead && styles.streamItemLead)}>
      <Link href={contentHref(item)} className={styles.streamLink}>
        <img
          src={resolveContentCoverUrl(item.cover, item.id)}
          alt=""
          className={styles.streamThumb}
        />
        <div className={styles.streamBody}>
          <span className={styles.streamType}>{TYPE_LABELS[entry.kind]}</span>
          <strong className={styles.streamTitle}>{item.title}</strong>
          {item.summary ? <p className={styles.streamDesc}>{item.summary}</p> : null}
          <span className={styles.streamAuthor}>{item.authorName || "星语创作者"}</span>
        </div>
        {hasMeta ? (
          <StreamMeta>
            {item.readMinutes ? <span>{item.readMinutes} 分钟</span> : null}
            {item.updatedAt ? <span>{formatDateTime(item.updatedAt)}</span> : null}
          </StreamMeta>
        ) : null}
      </Link>
    </li>
  );
}

export function DiscoverPrototypePage({
  nav,
  domainKey,
  sortKey,
  onFilterChange,
  articles,
  more,
  series,
  topics,
  creators,
  galaxies,
}: DiscoverPrototypePageProps) {
  const router = useRouter();
  const currentProfile = useCurrentProfile();
  const currentUsername = currentProfile.username?.trim().toLowerCase();
  const streamInput = useMemo(
    () => buildDiscoverMockStream(articles, more, series, topics),
    [articles, more, series, topics],
  );
  const stream = useMemo(
    () => buildDiscoverStream(streamInput.mockArticles, streamInput.mockMore, streamInput.mockSeries, streamInput.mockTopics),
    [streamInput],
  );
  const hotGalaxies = useMemo(
    () =>
      withHomeMock(galaxies, DISCOVER_MOCK_GALAXIES)
        .sort((left, right) => (right.memberCount ?? 0) - (left.memberCount ?? 0))
        .slice(0, 5),
    [galaxies],
  );
  const activeCreators = useMemo(
    () => withHomeMock(creators, DISCOVER_MOCK_CREATORS).slice(0, 5),
    [creators],
  );
  const activeDomain = nav.domainTabs.find((tab) => tab.key === domainKey);
  const activeDomainLabel = domainKey === "all" ? "全部" : activeDomain?.label;

  return (
    <main className={styles.discoverPage} data-layout="discover">
      <div className={cn(styles.toolbar)} role="toolbar" aria-label="探索导航">
        <div className={cn(styles.toolbarMain)}>
          {nav.mode !== "user" ? (
            <div className={cn(styles.toolbarLabel)}>
              <span className={cn(styles.toolbarLabelMark)} aria-hidden="true" />
              <span className={cn(styles.toolbarLabelText)}>{nav.sectionTitle}</span>
            </div>
          ) : null}
          <div className={cn(styles.typeTabs)} role="tablist" aria-label={nav.sectionTitle}>
            {nav.mode === "user" ? (
              <button
                key="all"
                type="button"
                role="tab"
                aria-selected={domainKey === "all"}
                title="汇总你已选探索方向的内容"
                className={cn(domainKey === "all" && styles.isActive)}
                onClick={() => onFilterChange("all", sortKey)}
              >
                全部
              </button>
            ) : null}
            {nav.domainTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={domainKey === tab.key}
                title={tab.description}
                className={cn(domainKey === tab.key && styles.isActive, tab.personal && styles.isPersonal)}
                onClick={() => onFilterChange(tab.key, sortKey)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className={cn(styles.sortRow)}>
          <div className={cn(styles.sortTabs)} role="tablist" aria-label="排序方式">
            {nav.sortTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={sortKey === tab.key}
                className={cn(sortKey === tab.key && styles.isActive)}
                onClick={() => onFilterChange(domainKey, tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(styles.filterBtn, "shrink-0")} aria-label="筛选与探索管理">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              筛选
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {nav.canManage ? (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => router.push("/me/interests")}
                >
                  <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  管理探索
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn(styles.body)}>
        <div className={cn(styles.layout, styles.layoutFirst)}>
          <section className={cn(styles.main, styles.mainCard)}>
            <header className={cn(styles.streamHead)}>
              <h2>
                {activeDomainLabel ? `${activeDomainLabel} · 推荐内容` : "推荐内容"}
              </h2>
              <p>{nav.feedHint}</p>
            </header>

            {stream.length > 0 ? (
              <ul className={cn(styles.stream)}>
                {stream.map((entry, index) => (
                  <StreamItemRow key={entry.key} entry={entry} lead={index === 0} />
                ))}
              </ul>
            ) : (
              <StreamEmpty nav={nav} />
            )}
          </section>

          <aside className={cn(styles.aside)}>
            <section className={cn(styles.asideBlock)}>
              <SectionHead title="热门星域" href="/galaxies" action="全部星域" />
              {hotGalaxies.length > 0 ? (
                <ul className={cn(styles.galaxyList)}>
                  {hotGalaxies.map((galaxy, index) => (
                    <li key={galaxy.id}>
                      <Link href={`/galaxies/${galaxy.slug}`} className={cn(styles.galaxyRow)}>
                        <span className={cn(styles.galaxyMark)} aria-hidden="true">
                          <Orbit className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong>{galaxy.name}</strong>
                          <small>{count(galaxy.memberCount)} 成员</small>
                        </span>
                        <span className={cn(styles.galaxyRank)}>{index + 1}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cn(styles.inlineEmpty)}>暂无星域推荐</p>
              )}
            </section>

            <section className={cn(styles.asideBlock)}>
              <SectionHead title="活跃创作者" href="/search?type=USER" />
              {activeCreators.length > 0 ? (
                <ul className={cn(styles.creatorList)}>
                  {activeCreators.map((creator, index) => (
                    <li key={creator.userId}>
                      <div className={cn(styles.creatorRow)}>
                        <span
                          className={cn(styles.creatorAvatar)}
                        >
                          {(creator.displayName || creator.username).slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/u/${creator.username}`} className={cn(styles.creatorName)}>
                            {creator.displayName || creator.username}
                          </Link>
                          <span className={cn(styles.creatorRole)}>
                            <Users className="h-3 w-3" aria-hidden="true" />
                            @{creator.username}
                          </span>
                        </div>
                        {currentUsername &&
                        creator.username.trim().toLowerCase() === currentUsername ? (
                          <span className={cn(styles.creatorSelf)} aria-label="当前账号">
                            我
                          </span>
                        ) : (
                          <FollowButton
                            username={creator.username}
                            compact
                            className={cn(styles.creatorFollow)}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cn(styles.inlineEmpty)}>暂无创作者推荐</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
