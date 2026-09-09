"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Filter,
  Hash,
  MessageCircle,
  Orbit,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { FollowButton } from "@/components/community/engagement";
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
import { cn } from "@/lib/utils";

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
    <div className="xy-discover-section-head">
      <h2>{title}</h2>
      {href ? (
        <Link href={href} className="xy-discover-section-link">
          {action}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function StreamEmpty({ nav }: { nav: ExploreNav }) {
  return (
    <div className="xy-discover-stream-empty">
      <p>
        {nav.mode === "user"
          ? "这个探索方向的内容还在汇集，试试切换其他方向或管理我的探索。"
          : "这个星域的内容还在汇集，可以先从其他官方领域开始。"}
      </p>
      <div className="xy-discover-stream-empty-links">
        {nav.canManage ? <Link href="/me/interests">管理我的探索</Link> : null}
        <Link href="/topics">逛逛话题</Link>
        <Link href="/galaxies">进入星域</Link>
      </div>
    </div>
  );
}

function StreamItemRow({ entry, lead = false }: { entry: DiscoverStreamItem; lead?: boolean }) {
  if (entry.kind === "series") {
    const item = entry.item;
    return (
      <li className={cn("xy-discover-stream-item", lead && "xy-discover-stream-item--lead")}>
        <Link href={`/series/${item.id}`} className="xy-discover-stream-link">
          <span className="xy-discover-stream-mark xy-discover-stream-mark--series" aria-hidden="true">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="xy-discover-stream-body">
            <span className="xy-discover-stream-type">{TYPE_LABELS.series}</span>
            <strong>{item.title}</strong>
            <small>
              {item.chapterCount !== undefined ? `共 ${item.chapterCount} 篇` : "连载中"}
              {item.updatedAt ? (
                <>
                  <span aria-hidden="true"> · </span>
                  {formatDateTime(item.updatedAt)}
                </>
              ) : null}
            </small>
          </span>
        </Link>
      </li>
    );
  }

  if (entry.kind === "topic") {
    const item = entry.item;
    return (
      <li className={cn("xy-discover-stream-item", lead && "xy-discover-stream-item--lead")}>
        <Link href={`/topics/${item.slug}`} className="xy-discover-stream-link">
          <span className="xy-discover-stream-mark xy-discover-stream-mark--topic" aria-hidden="true">
            <Hash className="h-3.5 w-3.5" />
          </span>
          <span className="xy-discover-stream-body">
            <span className="xy-discover-stream-type">{TYPE_LABELS.topic}</span>
            <strong># {item.name}</strong>
            <small>{count(item.contentCount)} 讨论</small>
          </span>
        </Link>
      </li>
    );
  }

  const item = entry.item;
  const isMoment = entry.kind === "moment";

  return (
    <li className={cn("xy-discover-stream-item", lead && "xy-discover-stream-item--lead")}>
      <Link href={contentHref(item)} className="xy-discover-stream-link">
        {item.cover ? (
          <img src={item.cover} alt="" className="xy-discover-stream-thumb" />
        ) : (
          <span
            className={cn(
              "xy-discover-stream-mark",
              isMoment ? "xy-discover-stream-mark--moment" : "xy-discover-stream-mark--article"
            )}
            aria-hidden="true"
          >
            {isMoment ? <MessageCircle className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
          </span>
        )}
        <span className="xy-discover-stream-body">
          <span className="xy-discover-stream-type">{TYPE_LABELS[entry.kind]}</span>
          <strong>{item.title}</strong>
          {item.summary ? <p>{item.summary}</p> : null}
          <small>
            {item.authorName || "星语创作者"}
            {item.updatedAt ? (
              <>
                <span aria-hidden="true"> · </span>
                {formatDateTime(item.updatedAt)}
              </>
            ) : null}
          </small>
        </span>
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
  const stream = useMemo(
    () => buildDiscoverStream(articles, more, series, topics),
    [articles, more, series, topics]
  );
  const hotGalaxies = useMemo(
    () => [...galaxies].sort((left, right) => (right.memberCount ?? 0) - (left.memberCount ?? 0)).slice(0, 5),
    [galaxies]
  );
  const activeCreators = useMemo(() => creators.slice(0, 5), [creators]);
  const activeDomain = nav.domainTabs.find((tab) => tab.key === domainKey);
  const activeDomainLabel = domainKey === "all" ? "全部" : activeDomain?.label;

  return (
    <main className="xy-discover-page">
      <div className="xy-discover-first-screen">
        <header className="xy-discover-hero">
          <img src="/prototype-assets/discover/hero-cosmos.png" alt="" className="xy-discover-hero-art" />
          <div className="xy-discover-hero-copy">
            <span className="xy-discover-hero-kicker">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              探索
            </span>
            <h1>探索星辰大海，发现优质内容</h1>
            <p className="xy-discover-hero-desc">官方领域星图指引方向，标签关联内容，按你的探索路径推荐</p>
            <Link href="/search" className="xy-discover-hero-cta">
              开始探索
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="xy-discover-hero-note">
            <span>{nav.mode === "user" ? "全部" : "官方星图"}</span>
            <strong>{activeDomainLabel ?? (nav.mode === "user" ? "全部" : "技术")}</strong>
            <small>标签 · 领域 · 推荐</small>
          </div>
        </header>
      </div>

      <div className="xy-discover-toolbar" role="toolbar" aria-label="探索导航">
        <div className="xy-discover-toolbar-main">
          {nav.mode !== "user" ? (
            <div className="xy-discover-toolbar-label">
              <span className="xy-discover-toolbar-label-mark" aria-hidden="true" />
              <span className="xy-discover-toolbar-label-text">{nav.sectionTitle}</span>
            </div>
          ) : null}
          <div className="xy-discover-type-tabs" role="tablist" aria-label={nav.sectionTitle}>
            {nav.mode === "user" ? (
              <button
                key="all"
                type="button"
                role="tab"
                aria-selected={domainKey === "all"}
                title="汇总你已选探索方向的内容"
                className={cn(domainKey === "all" && "is-active")}
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
                className={cn(domainKey === tab.key && "is-active", tab.personal && "is-personal")}
                onClick={() => onFilterChange(tab.key, sortKey)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="xy-discover-sort-row">
          <div className="xy-discover-sort-tabs" role="tablist" aria-label="排序方式">
            {nav.sortTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={sortKey === tab.key}
                className={cn(sortKey === tab.key && "is-active")}
                onClick={() => onFilterChange(domainKey, tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="xy-discover-filter-btn shrink-0" aria-label="筛选与探索管理">
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

      <div className="xy-discover-body">
        <div className="xy-discover-layout xy-discover-layout-first">
          <section className="xy-discover-main">
            <header className="xy-discover-stream-head">
              <div>
                <span className="xy-discover-stream-kicker">今日探索</span>
                <h2>
                  {activeDomainLabel ? `${activeDomainLabel} · 推荐内容流` : "推荐内容流"}
                </h2>
              </div>
              <p>{nav.feedHint}</p>
            </header>

            {stream.length > 0 ? (
              <ul className="xy-discover-stream">
                {stream.map((entry, index) => (
                  <StreamItemRow key={entry.key} entry={entry} lead={index === 0} />
                ))}
              </ul>
            ) : (
              <StreamEmpty nav={nav} />
            )}
          </section>

          <aside className="xy-discover-aside">
            <section className="xy-discover-aside-block">
              <SectionHead title="热门星域" href="/galaxies" action="全部星域" />
              {hotGalaxies.length > 0 ? (
                <ul className="xy-discover-galaxy-list">
                  {hotGalaxies.map((galaxy, index) => (
                    <li key={galaxy.id}>
                      <Link href={`/galaxies/${galaxy.slug}`} className="xy-discover-galaxy-row">
                        <span className="xy-discover-galaxy-mark" aria-hidden="true">
                          <Orbit className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong>{galaxy.name}</strong>
                          <small>{count(galaxy.memberCount)} 成员</small>
                        </span>
                        <span className="xy-discover-galaxy-rank">{index + 1}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="xy-discover-inline-empty">暂无星域推荐</p>
              )}
            </section>

            <section className="xy-discover-aside-block">
              <SectionHead title="活跃创作者" href="/search?type=USER" />
              {activeCreators.length > 0 ? (
                <ul className="xy-discover-creator-list">
                  {activeCreators.map((creator, index) => (
                    <li key={creator.userId}>
                      <div className="xy-discover-creator-row">
                        <span
                          className="xy-discover-creator-avatar"
                          style={{ background: index % 2 ? "#7490c7" : "#13234d" }}
                        >
                          {(creator.displayName || creator.username).slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/u/${creator.username}`} className="xy-discover-creator-name">
                            {creator.displayName || creator.username}
                          </Link>
                          <span className="xy-discover-creator-role">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            @{creator.username}
                          </span>
                        </div>
                        <FollowButton
                          username={creator.username}
                          compact
                          className="h-8 shrink-0 px-2.5 text-xs [&_svg]:hidden"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="xy-discover-inline-empty">暂无创作者推荐</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
