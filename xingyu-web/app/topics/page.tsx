"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Code2, Hash, Leaf, PenLine, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi, type TopicSummary } from "@/lib/community-api";

function formatCount(value?: number) {
  if (!value) return "0";
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

const graphPositions = [
  "left-[43%] top-[28%] h-28 w-28 bg-[#17356e]",
  "left-[64%] top-[38%] h-24 w-24 bg-[#716bc8]",
  "left-[31%] top-[58%] h-20 w-20 bg-[#3f82d9]",
  "left-[49%] top-[68%] h-20 w-20 bg-[#ee9a3e]",
];

const categoryMeta = [
  { title: "技术", color: "#3f82d9", icon: Code2 },
  { title: "设计", color: "#7770cb", icon: PenLine },
  { title: "创作", color: "#ef9d3d", icon: BookOpen },
  { title: "生活", color: "#66bb8d", icon: Leaf },
];

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi.getTopics().then(setTopics).catch(() => setTopics([])).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return topics;
    return topics.filter((topic) => `${topic.name} ${topic.description || ""} ${topic.slug}`.toLowerCase().includes(keyword));
  }, [query, topics]);

  const featured = [...visible].sort((left, right) => (right.followerCount ?? right.contentCount ?? 0) - (left.followerCount ?? left.contentCount ?? 0)).slice(0, 4);
  const categoryTopics = Array.from({ length: 4 }, (_, categoryIndex) => visible.filter((_, index) => index % 4 === categoryIndex).slice(0, 3));
  async function follow(topic: TopicSummary) {
    setPending(topic.id); setError(null);
    try {
      if (followed.has(topic.id)) await communityApi.unfollowTopic(topic.id);
      else await communityApi.followTopic(topic.id);
      setFollowed((current) => { const next = new Set(current); next.has(topic.id) ? next.delete(topic.id) : next.add(topic.id); return next; });
    } catch { setError("关注操作失败，请确认登录状态后重试。"); }
    finally { setPending(null); }
  }

  return (
    <AppShell>
      <main className="mx-auto w-[calc(100%_-_2rem)] max-w-[1464px] pb-8 pt-4">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_354px]">
          <section className="relative min-h-[390px] overflow-hidden">
            <div className="absolute left-1 top-2 z-10">
              <h1 className="text-[36px] font-semibold tracking-[-0.055em] text-[#13234d]">探索话题 <Sparkles className="inline h-7 w-7 align-[0.08em] text-[#efa66d]" aria-hidden="true" /></h1>
              <p className="mt-2 text-base text-[#687188]">连接兴趣，发现更多值得深入的领域</p>
            </div>
            <form action="/search" className="absolute right-3 top-1 z-20 w-[336px] max-w-[42%]">
              <Search className="pointer-events-none absolute left-4 top-5 h-4 w-4 text-[#7c8497]" />
              <Input name="q" value={query} onChange={(event)=>setQuery(event.target.value)} className="h-12 rounded-xl bg-white/72 pl-11" placeholder="搜索话题" aria-label="搜索话题" />
              <p className="mt-2 text-xs text-[#8b92a3]">支持搜索话题、关键词或 @用户</p>
            </form>

            <div className="xy-topic-orbits absolute inset-x-5 bottom-1 top-24">
              {featured.map((topic,index)=><Link key={topic.id} href={`/topics/${topic.slug}`} className={`absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-center text-white shadow-lg ${graphPositions[index]}`}><span><strong className="block text-[18px]">{topic.name}</strong><small className="mt-1 block text-white/85">{formatCount(topic.followerCount || topic.contentCount)} 关注</small></span></Link>)}
              {visible.slice(4,14).map((topic,index)=>{
                const coords=[[9,34],[22,12],[15,68],[25,91],[48,2],[55,54],[70,14],[83,37],[75,78],[88,67]][index] || [10+index*7,50];
                return <Link key={topic.id} href={`/topics/${topic.slug}`} style={{left:`${coords[0]}%`,top:`${coords[1]}%`}} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e1e5f1] bg-white/78 px-3 py-1.5 text-sm text-[#58627a] shadow-sm"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#9ba9cf]" />{topic.name}</Link>;
              })}
            </div>
          </section>

          <aside className="xy-home-source-panel min-h-[398px] p-4">
            <div className="flex items-center justify-between border-b border-[#ece8e1] pb-4"><h2 className="text-[18px] font-semibold">热门话题</h2><Link href="/topics" className="text-sm text-[#59637b]">查看全部</Link></div>
            {loading ? <p className="mt-5 text-sm text-[#7f8798]">加载中…</p> : visible.length ? <ul className="divide-y divide-[#ece8e1]">{visible.slice(0,4).map((topic,index)=><li key={topic.id} className="flex items-center gap-3 py-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${index%5===0?'bg-[#17356e]':index%5===1?'bg-[#7a73cd]':index%5===2?'bg-[#efa03f]':index%5===3?'bg-[#4387d7]':'bg-[#63b6ae]'}`}><Sparkles className="h-5 w-5" /></span><Link href={`/topics/${topic.slug}`} className="min-w-0 flex-1"><strong className="block truncate text-sm">{topic.name}</strong><small className="text-[#8a92a2]">{formatCount(topic.followerCount || topic.contentCount)} 关注者</small></Link><Button variant="outline" size="sm" className="h-8" asChild><Link href={`/topics/${topic.slug}`}>查看</Link></Button></li>)}</ul> : <EmptyState compact title="暂无话题" description="社区话题上线后会显示在这里" actionLabel="去发现" actionHref="/discover" />}
            {visible.length>6&&<Link href="/topics" className="mt-4 flex items-center justify-center text-sm text-[#5e67b2]">查看全部 {visible.length} 个 ›</Link>}
          </aside>
        </div>

        <section className="xy-home-source-panel mt-4 grid overflow-hidden lg:grid-cols-4">
          {categoryMeta.map((meta,categoryIndex)=>{
            const Icon=meta.icon; return <div key={meta.title} className="border-b border-r border-[#ece8e1] p-4 last:border-r-0 lg:border-b-0"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[17px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{background:meta.color}} />{meta.title}</h2><Link href={`/search?q=${encodeURIComponent(meta.title)}`} className="text-sm text-[#677188]">更多 ›</Link></div><ul className="mt-2 space-y-2.5">{categoryTopics[categoryIndex].map((topic)=><li key={topic.id} className="flex items-center gap-2.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white" style={{background:meta.color}}><Icon className="h-5 w-5" /></span><Link href={`/topics/${topic.slug}`} className="min-w-0 flex-1"><strong className="block truncate text-sm">{topic.name}</strong><small className="mt-0.5 block line-clamp-1 text-[#8890a1]">{topic.description || '发现围绕该领域的优质内容'}</small><small className="text-[#8890a1]">{formatCount(topic.followerCount)} 关注 · {formatCount(topic.contentCount)} 内容</small></Link><Button variant="outline" size="sm" className="h-8" disabled={pending === topic.id} onClick={() => void follow(topic)}>{pending === topic.id ? "处理中" : followed.has(topic.id) ? "已关注" : "关注"}</Button></li>)}</ul></div>;
          })}
        </section>

        {error && <Alert variant="destructive" className="mt-4">{error}</Alert>}
        <section id="topic-ranking" className="xy-home-source-panel xy-topic-rising-panel mt-6">
          <div className="flex shrink-0 items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff0e7] text-[#ef7544]"><Hash className="h-6 w-6" /></span><div><h2 className="text-lg font-semibold">正在升温</h2><p className="text-sm text-[#7c8497]">过去 7 天热度上升最快的话题</p></div></div>
          {visible.slice(0,5).map((topic,index)=><Link href={`/topics/${topic.slug}`} key={topic.id} className="flex min-w-40 shrink-0 items-center gap-3 border-l border-[#ebe7df] pl-6"><span className={`grid h-8 w-8 place-items-center rounded-full text-lg font-semibold ${index<2?'bg-[#fff0e1] text-[#ef7f3c]':'bg-[#eef2fb] text-[#406abb]'}`}>{index+1}</span><span><strong className="block text-sm">{topic.name}</strong><small className="text-[#ef5f42]">热度 ↑ {120-index*14}%</small></span></Link>)}
          <Button variant="outline" className="ml-auto shrink-0" asChild><a href="#topic-ranking">查看完整榜单</a></Button>
        </section>
      </main>
    </AppShell>
  );
}
