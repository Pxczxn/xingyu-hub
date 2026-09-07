"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Compass,
  FileText,
  MessageCircle,
  PenLine,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  communityApi,
  type ContentSummary,
  type GalaxySummary,
  type SeriesSummary,
  type TopicSummary,
} from "@/lib/community-api";

type BoardItem = { id: string; title: string; meta: string; href: string };
type Board = {
  title: string;
  description: string;
  asset: string;
  items: BoardItem[];
};
const NAV = [
  [Compass, "发现", "/discover"],
  [UsersRound, "星系", "/galaxies"],
  [PenLine, "创作", "/studio"],
  [MessageCircle, "消息", "/messages"],
  [Bookmark, "书架", "/me/bookshelf"],
  [Trophy, "全站榜单", "/rankings"],
] as const;

export default function RankingsPage() {
  const [content, setContent] = useState<ContentSummary[]>([]);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [galaxies, setGalaxies] = useState<GalaxySummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      communityApi.getDiscover({ limit: 12 }),
      communityApi.listSeries(8),
      communityApi.getGalaxies(),
      communityApi.getTopics(),
    ])
      .then(([discover, seriesResult, galaxiesResult, topicsResult]) => {
        setContent(discover.status === "fulfilled" ? discover.value.items : []);
        setSeries(
          seriesResult.status === "fulfilled" ? seriesResult.value : [],
        );
        setGalaxies(
          galaxiesResult.status === "fulfilled" ? galaxiesResult.value : [],
        );
        setTopics(
          topicsResult.status === "fulfilled" ? topicsResult.value : [],
        );
      })
      .finally(() => setLoading(false));
  }, []);
  const boards = useMemo<Board[]>(
    () => [
      {
        title: "公开内容",
        description: "来自社区的最新公开内容",
        asset: "article",
        items: content
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.authorName || "作者信息待提供",
            href: `/articles/${encodeURIComponent(item.id)}`,
          })),
      },
      {
        title: "系列精选",
        description: "连载与系统化内容",
        asset: "series",
        items: series
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.description || `${item.chapterCount ?? 0} 个章节`,
            href: `/series/${encodeURIComponent(item.id)}`,
          })),
      },
      {
        title: "社区星系",
        description: "围绕共同兴趣聚集的空间",
        asset: "creator",
        items: galaxies
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.name,
            meta:
              item.memberCount == null
                ? "成员信息待提供"
                : `${item.memberCount} 位成员`,
            href: `/galaxies/${encodeURIComponent(item.slug)}`,
          })),
      },
      {
        title: "热门话题",
        description: "正在被讨论的主题入口",
        asset: "growth",
        items: topics
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.name,
            meta: item.description || `${item.contentCount ?? 0} 条内容`,
            href: `/topics/${encodeURIComponent(item.slug)}`,
          })),
      },
    ],
    [content, galaxies, series, topics],
  );
  return (
    <AppShell>
      <main className="xy-rank-page">
        <aside className="xy-rank-rail">
          <h2>星语社区</h2>
          <nav>
            {NAV.map(([Icon, label, href]) => (
              <Link
                className={label === "全站榜单" ? "active" : ""}
                href={href}
                key={label}
              >
                <Icon />
                {label}
              </Link>
            ))}
          </nav>
          <blockquote>
            知识如星辰
            <br />
            汇聚成星系
          </blockquote>
        </aside>
        <section className="xy-rank-content">
          <header>
            <h1>全站榜单</h1>
            <p>发现社区中的公开内容、系列、星系与话题</p>
            <nav>
              <button className="active" type="button" disabled>
                当前精选
              </button>
              <button type="button" disabled>
                周榜待接入
              </button>
              <button type="button" disabled>
                月榜待接入
              </button>
            </nav>
          </header>
          <section className="xy-rank-grid">
            {boards.map((board) => (
              <article key={board.title}>
                <header>
                  <h2>
                    <Sparkles /> {board.title}
                  </h2>
                  <p>{board.description}</p>
                </header>
                <small>公开列表</small>
                {board.items.length ? (
                  board.items.map((item, index) => (
                    <Link href={item.href} key={item.id}>
                      <i>{index + 1}</i>
                      <Image
                        src={`/prototype-assets/rankings/${board.asset}-${["one", "two", "three"][index]}.png`}
                        alt=""
                        aria-hidden="true"
                        width={48}
                        height={46}
                      />
                      <span>
                        <b>{item.title}</b>
                        <small>{item.meta}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="xy-rank-board-empty">
                    {loading ? "正在加载…" : "暂无可展示内容"}
                  </p>
                )}
                <Link
                  href={
                    board.title === "公开内容"
                      ? "/discover"
                      : board.title === "系列精选"
                        ? "/series"
                        : board.title === "社区星系"
                          ? "/galaxies"
                          : "/topics"
                  }
                >
                  查看全部　›
                </Link>
              </article>
            ))}
          </section>
          <blockquote className="xy-rank-quote">
            “在星语，每一次思考都值得被记录。”
            <small>阅读、互动与成长值排行榜将在接口支持后开放。</small>
          </blockquote>
        </section>
      </main>
    </AppShell>
  );
}
