"use client";

import Link from "next/link";
import { ChevronDown, FileText, Search, Star, UserRound, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { communityApi, type ProfileDetail, type TopicCreatorSummary } from "@/lib/community-api";

type CreatorCard = TopicCreatorSummary & { profile?: ProfileDetail | null; works?: Array<{ id: string; title: string; categorySlug?: string | null }>; topics: string[] };

function Avatar({ creator }: { creator: CreatorCard }) { const name = creator.profile?.displayName || creator.displayName || creator.username; return <span className="xy-creator-real-avatar">{creator.profile?.avatar ? <img src={creator.profile.avatar} alt={`${name} 的头像`} /> : name.slice(0, 1).toUpperCase()}</span>; }

export default function CreatorsPage() {
  const [topics, setTopics] = useState<Array<{ id: string; slug: string; name: string; description?: string; contentCount?: number }>>([]);
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [activeTopic, setActiveTopic] = useState("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    communityApi.getTopics().then(async (topicRows) => {
      const selectedTopics = topicRows.slice(0, 8);
      const creatorRows = await Promise.all(selectedTopics.map(async (topic) => ({ topic, creators: await communityApi.getTopicCreators(topic.slug, 8).catch(() => []) })));
      const grouped = new Map<string, CreatorCard>();
      creatorRows.forEach(({ topic, creators: rows }) => rows.forEach((creator) => {
        const current = grouped.get(creator.username);
        grouped.set(creator.username, current ? { ...current, contentCount: Math.max(current.contentCount, creator.contentCount), topics: [...current.topics, topic.name] } : { ...creator, topics: [topic.name] });
      }));
      const cards = await Promise.all([...grouped.values()].slice(0, 12).map(async (creator) => {
        const [profile, works] = await Promise.all([communityApi.getProfile(creator.username).catch(() => null), communityApi.getUserWorks(creator.username).then((data) => data.works.slice(0, 1)).catch(() => [])]);
        return { ...creator, profile, works };
      }));
      if (active) { setTopics(selectedTopics); setCreators(cards); setLoading(false); }
    }).catch(() => { if (active) { setError("推荐作者暂时无法加载，请稍后重试。"); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const visibleCreators = useMemo(() => creators.filter((creator) => (activeTopic === "ALL" || creator.topics.includes(activeTopic)) && `${creator.displayName || ""} ${creator.username} ${creator.topics.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [activeTopic, creators, query]);
  async function toggleFollow(creator: CreatorCard) { try { if (creator.profile?.following) await communityApi.unfollowUser(creator.username); else await communityApi.followUser(creator.username); setCreators((rows) => rows.map((row) => row.username === creator.username ? { ...row, profile: row.profile ? { ...row.profile, following: !row.profile.following } : row.profile } : row)); } catch { setError("关注操作未完成，请确认登录状态后重试。"); } }

  return <AppShell><main className="xy-creators-page xy-creators-real">
    {error ? <Alert variant="destructive">{error}</Alert> : null}
    <section className="xy-creators-content"><header><h1>推荐作者</h1><p>从真实社区专题中发现值得关注的创作者。</p></header><nav className="xy-creator-filters" aria-label="按专题筛选作者"><button type="button" className={activeTopic === "ALL" ? "active" : ""} onClick={() => setActiveTopic("ALL")}>全部</button>{topics.map((topic) => <button type="button" className={activeTopic === topic.name ? "active" : ""} onClick={() => setActiveTopic(topic.name)} key={topic.id}>{topic.name}</button>)}<label><Search /><span className="sr-only">搜索作者</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作者或专题" /></label></nav><div className="xy-creators-layout"><section className="xy-author-grid">{loading ? <p className="xy-creator-real-status">正在加载作者…</p> : null}{visibleCreators.map((creator) => { const name = creator.profile?.displayName || creator.displayName || creator.username; const work = creator.works?.[0]; return <article key={creator.username}><header><Avatar creator={creator} /><div><h2>{name}<Star /></h2><p>{creator.topics.join(" · ") || "社区创作者"}</p></div></header><small>已发布内容</small><p className="xy-author-tags"><span>{creator.contentCount} 篇</span>{creator.topics.slice(0, 2).map((topic) => <span key={topic}>{topic}</span>)}</p>{work ? <Link href={`/articles/${encodeURIComponent(work.id)}`} className="xy-author-work"><span><small>最新公开作品</small><b>{work.title || "未命名作品"}</b><em>{work.categorySlug ? `分类：${work.categorySlug}` : "文章作品"}</em></span><i><FileText /></i></Link> : <div className="xy-creator-real-work-empty"><FileText />暂未获得公开作品</div>}<footer><Link href={`/users/${encodeURIComponent(creator.username)}`}>查看主页</Link><button type="button" onClick={() => void toggleFollow(creator)}>{creator.profile?.following ? "已关注" : "关注"}</button></footer></article>; })}{!loading && !visibleCreators.length ? <div className="xy-creator-real-status"><UsersRound /><h2>暂无匹配作者</h2><p>调整专题或关键词后再试。</p></div> : null}</section><aside className="xy-creators-side"><section><header><h2>按专题推荐</h2><Link href="/topics">更多 ›</Link></header>{topics.map((topic) => <Link href={`/topics/${encodeURIComponent(topic.slug)}`} key={topic.id}><i><Star /></i><span><b>{topic.name}</b><small>{topic.description || "社区专题"}</small></span><em>{typeof topic.contentCount === "number" ? `${topic.contentCount} 篇` : "查看 ›"}</em></Link>)}{!loading && !topics.length ? <p>暂无可展示专题。</p> : null}</section><section><h2>你可能感兴趣</h2>{creators.slice(0, 3).map((creator) => <Link href={`/users/${encodeURIComponent(creator.username)}`} key={creator.username}><Avatar creator={creator} /><span><b>{creator.profile?.displayName || creator.displayName || creator.username}</b><small>{creator.topics[0] || "社区创作者"}</small></span></Link>)}</section></aside></div></section>
  </main></AppShell>;
}
