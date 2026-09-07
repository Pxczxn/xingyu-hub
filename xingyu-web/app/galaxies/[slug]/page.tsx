"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

const contentImages = ["content-cloud", "content-coffee", "content-nebula"];
const formatJoinedAt = (value?: string) => value ? new Date(value).toLocaleDateString("zh-CN") : "加入时间暂未提供";

export default function GalaxyDetailPage() {
  const { slug: raw } = useParams<{ slug: string }>();
  const slug = decodeURIComponent(raw || "");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const { data: galaxy, loading, error } = useAsyncData(() => communityApi.getGalaxy(slug), [slug]);
  const { data: members } = useAsyncData(() => communityApi.getGalaxyMembers(slug), [slug]);
  const { data: content } = useAsyncData(() => communityApi.getGalaxyContent(slug), [slug]);
  const { data: mine } = useAsyncData(() => communityApi.getMyGalaxies().catch(() => []), []);
  const items = useMemo(() => [...(content ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned)), [content]);
  const isMember = joined || mine?.some((x) => x.slug === slug || x.id === galaxy?.id);
  async function join() { setJoining(true); setJoinError(null); try { await communityApi.joinGalaxy(slug); setJoined(true); } catch { setJoinError("加入失败，请确认已登录"); } finally { setJoining(false); } }
  if (loading) return <AppShell><main className="xy-galaxy-detail"><p>正在进入星系…</p></main></AppShell>;
  if (error || !galaxy) return <AppShell><main className="xy-galaxy-detail"><Alert variant="destructive">{error || "星系不存在"}</Alert></main></AppShell>;
  return <AppShell><main className="xy-galaxy-detail">
    <section className="xy-galaxy-detail-hero"><Image src="/prototype-assets/galaxy-detail/hero-space.png" alt="" aria-hidden="true" fill priority/><div className="xy-galaxy-detail-logo"><Image src="/prototype-assets/galaxies/featured-orbit.png" alt="" aria-hidden="true" fill/></div><div className="xy-galaxy-detail-copy"><div><h1>{galaxy.name}</h1><span>{galaxy.official ? "官方星系" : "社区星系"}</span></div><h2>在公开内容与协作讨论中，找到同频的人。</h2><p>星系用于聚合相关内容、成员与持续的社区共创记录；具体介绍以星系实际公开信息为准。</p><b>{galaxy.memberCount === undefined ? "成员数据暂未提供" : `${galaxy.memberCount} 位成员`}</b></div>{isMember ? <span className="xy-galaxy-join" aria-label="已加入星系">已加入星系</span> : <Button className="xy-galaxy-join" disabled={joining} onClick={() => void join()}><Users className="mr-2 h-5 w-5"/>{joining ? "加入中…" : "加入星系"}</Button>}</section>
    {joinError && <Alert variant="destructive" className="mt-4">{joinError}</Alert>}
    <div className="xy-galaxy-detail-layout"><section className="xy-galaxy-content-panel"><nav><b>内容</b><Link href={`/galaxies/${slug}/members`}>成员</Link><Link href={`/galaxies/${slug}/content`}>内容流</Link></nav><div className="xy-galaxy-content-list"><div className="flex justify-between"><b>最新内容</b><span>{items.length} 条</span></div>{items.length === 0 ? <EmptyState compact title="暂无内容" description="运营关联的内容会展示在这里"/> : items.slice(0, 4).map((item, i) => <Link href={contentHref({ id: item.objectId, objectType: item.objectType })} key={item.id}><Image src={`/prototype-assets/galaxy-detail/${contentImages[i % 3]}.png`} alt="" aria-hidden="true" width={188} height={116}/><div><h3>{item.title || "内容标题暂未提供"}{item.pinned && <small>置顶</small>}</h3><p>{item.objectType || "内容类型暂未提供"}</p><span>关联到当前星系的公开内容</span></div><aside><span>互动数据暂未提供</span></aside></Link>)}</div></section><aside className="xy-galaxy-detail-side"><section><div className="xy-galaxy-section-title"><h2>星系星图</h2><Link href={`/galaxies/${slug}/content`}>浏览内容 <ArrowRight/></Link></div><Image src="/prototype-assets/galaxy-detail/galaxy-map.png" alt="" aria-hidden="true" width={345} height={177}/></section><section><div className="xy-galaxy-section-title"><h2>星系成员</h2><Link href={`/galaxies/${slug}/members`}>全部成员 <ArrowRight/></Link></div>{(members ?? []).slice(0, 4).map((m) => <div className="xy-galaxy-activity" key={m.userId}><span>{(m.displayName || m.username).slice(0, 1)}</span><p><b>{m.displayName || m.username}</b>　{m.role || "成员"}</p><time>{formatJoinedAt(m.joinedAt)}</time></div>)}{!members?.length && <p className="xy-galaxy-empty">暂无可展示的成员。</p>}</section><section><h2>星系信息</h2><div><span>公开状态</span><b>{galaxy.official ? "官方星系" : "社区星系"}</b></div><div><span>成员数</span><b>{galaxy.memberCount === undefined ? "暂未提供" : galaxy.memberCount}</b></div><div><span>关联内容</span><b>{items.length} 条</b></div></section></aside></div>
  </main></AppShell>;
}
