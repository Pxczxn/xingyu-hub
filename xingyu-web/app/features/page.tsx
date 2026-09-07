"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CircleHelp,
  Clock3,
  FolderOpen,
  Home,
  Settings,
  Share2,
  Star,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi, type ContentSummary, type FollowUser, type SeriesSummary, type TopicSummary } from "@/lib/community-api";

const artNames = ["rec-one", "rec-two", "rec-three"];
export default function FeaturedCollectionPage() {
  const [picks, setPicks] = useState<ContentSummary[]>([]);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [curators, setCurators] = useState<FollowUser[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);

  useEffect(() => {
    void Promise.allSettled([
      communityApi.getDiscover({ limit: 9 }),
      communityApi.listSeries(5),
      communityApi.getSuggestedUsers(3),
      communityApi.getTopics(),
    ]).then(([discover, seriesResult, users, topicResult]) => {
      if (discover.status === "fulfilled") setPicks(discover.value.items.slice(0, 3));
      if (seriesResult.status === "fulfilled") setSeries(seriesResult.value.slice(0, 5));
      if (users.status === "fulfilled") setCurators(users.value.slice(0, 3));
      if (topicResult.status === "fulfilled") setTopics(topicResult.value.slice(0, 8));
    });
  }, []);

  return (
    <AppShell>
      <main className="xy-feature-page">
        <aside className="xy-feature-rail">
          <h2>✦ 星语社区</h2>
          <nav>
            {[
              [Home, "首页"],
              [Clock3, "最新动态"],
              [UsersRound, "关注"],
              [Star, "专题合集"],
              [UsersRound, "星球"],
              [CircleHelp, "问答"],
              [BookOpen, "活动"],
              [FolderOpen, "资源库"],
            ].map(([Icon, x], i) => (
              <Link
                className={i === 3 ? "active" : ""}
                href={i === 3 ? "/features" : "/discover"}
                key={String(x)}
              >
                <Icon />
                {String(x)}
              </Link>
            ))}
          </nav>
          <small>我的</small>
          {[
            [BookOpen, "我的发表"],
            [Star, "我的收藏"],
            [Clock3, "浏览历史"],
            [FolderOpen, "草稿箱"],
            [Settings, "设置"],
          ].map(([Icon, x]) => (
            <Link href="/me" key={String(x)}>
              <Icon />
              {String(x)}
            </Link>
          ))}
          <Link className="xy-feature-write" href="/studio">
            <Image
              src="/prototype-assets/featured-collection/write.png"
              alt="写下你的星语"
              width={168}
              height={122}
            />
            <b>写下你的星语</b>
            <span>开始创作</span>
          </Link>
        </aside>
        <section className="xy-feature-content">
          <section className="xy-feature-hero">
            <Image
              src="/prototype-assets/featured-collection/hero.png"
              alt=""
              aria-hidden="true"
              width={730}
              height={395}
            />
            <div>
              <span>内容策展</span>
              <h1>值得慢慢读完的内容</h1>
              <h2>从新的观点出发，留下一段自己的阅读轨迹</h2>
              <p>
                这里汇集了社区中正在被阅读、讨论与持续更新的内容。你可以从推荐文章、系列和话题中继续探索。
              </p>
              <small>{picks.length ? `已收录 ${picks.length} 篇公开内容` : "内容将在这里逐步汇集"}</small>
              <Link className="xy-feature-hero-action" href="/discover">浏览内容</Link>
              <Link className="xy-feature-hero-share" href="/share" aria-label="分享">
                <Share2 />
              </Link>
            </div>
          </section>
          <div className="xy-feature-grid">
            <section className="xy-feature-picks">
              <h2>✺ 编辑推荐</h2>
              <div>
                {picks.length ? picks.map((item, i) => (
                  <Link href={`/articles/${item.id}`} key={item.id}>
                    <Image
                      src={`/prototype-assets/featured-collection/${artNames[i % artNames.length]}.png`}
                      alt=""
                      aria-hidden="true"
                      width={90}
                      height={131}
                    />
                    <span>
                      <i>{item.objectType || "内容"}</i>
                      <b>{item.title}</b>
                      <p>{item.summary || "该内容暂未提供摘要。"}</p>
                      <small>{item.authorName || "作者信息暂未提供"}{item.readMinutes ? ` · 约 ${item.readMinutes} 分钟` : ""}</small>
                    </span>
                  </Link>
                )) : <p className="xy-feature-empty">暂无可展示的公开推荐内容。</p>}
              </div>
            </section>
            <section className="xy-feature-chapters">
              <header>
                <h2>✺ 系列章节</h2>
                <Link href="/series">查看全部 ›</Link>
              </header>
              {series.length ? series.map((item, i) => (
                <Link href={`/series/${item.slug || item.id}`} key={item.id}>
                  <i>0{i + 1}</i>
                  {item.title}
                  <small>{item.chapterCount === undefined ? "章节数暂未提供" : `${item.chapterCount} 篇文章`}</small>
                </Link>
              )) : <p className="xy-feature-empty">暂无可展示的系列。</p>}
            </section>
            <section className="xy-feature-curators">
              <h2>策展人</h2>
              <div>
                {curators.length ? curators.map((user, i) => (
                  <article key={user.userId}>
                    <Image
                      src={`/prototype-assets/featured-collection/curator-${["one", "two", "three"][i]}.png`}
                      alt=""
                      aria-hidden="true"
                      width={68}
                      height={75}
                    />
                    <div>
                      <h3>
                        {user.displayName || user.username}
                        <span>推荐作者</span>
                      </h3>
                      <p>来自星语社区的公开推荐作者。</p>
                      <small>{user.followedAt ? "已被收录至推荐" : "作者信息待补充"}</small>
                    </div>
                    <Link className="xy-feature-follow" href={`/users/${user.username}`}>查看</Link>
                  </article>
                )) : <p className="xy-feature-empty">暂无可展示的推荐作者。</p>}
              </div>
            </section>
            <section className="xy-feature-related">
              <h2>关联话题</h2>
              <p>
                {topics.map((topic) => (
                  <Link href={`/topics/${topic.slug}`} key={topic.id}>
                    # {topic.name}
                  </Link>
                ))}
              </p>
              <small>{topics.length ? "话题热度与关注数据以各话题详情为准" : "暂无可展示的关联话题"}</small>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
