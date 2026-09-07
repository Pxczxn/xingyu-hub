"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, Clock3, MessageCircle, Play, Star, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

export default function SeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { data: series, error, loading } = useAsyncData(() => communityApi.getSeries(seriesId), [seriesId]);
  if (loading) return <AppShell><main className="xy-series-detail"><p>正在加载系列…</p></main></AppShell>;
  if (error || !series) return <AppShell><main className="xy-series-detail"><Alert variant="destructive">{error || "系列不存在或尚未公开"}</Alert></main></AppShell>;
  const chapters = [...(series.chapters ?? [])].sort((a, b) => a.position - b.position);
  return <AppShell><main className="xy-series-detail"><div className="xy-series-breadcrumb"><Link href="/series">系列广场</Link><span>/</span><span>{series.title}</span></div><section className="xy-series-detail-hero"><Image src="/prototype-assets/series-detail/series-cover.png" alt="" aria-hidden="true" width={353} height={266} className="xy-series-detail-cover"/><div className="xy-series-detail-copy"><span className="xy-series-tag">{series.status}</span><h1>{series.title}</h1><p>{series.description || "该系列暂未提供简介。"}</p><div className="xy-series-detail-meta"><span><BookOpen/>{chapters.length} 章</span><span><Users/>追更数据暂未提供</span><span><Clock3/>{formatDateTime(series.updatedAt)} 更新</span></div><div className="flex gap-3"><Button asChild className="rounded-xl bg-orange-500 hover:bg-orange-600"><Link href={`/series/${seriesId}/read`}><Play className="mr-2 h-4 w-4"/>开始阅读</Link></Button><Button variant="outline" className="rounded-xl" disabled title="书架接口暂未提供"><Star className="mr-2 h-4 w-4"/>加入书架</Button></div></div><aside className="xy-series-detail-intro"><h2>系列简介</h2><p>{series.description || "作者尚未提供系列简介。"}</p><div><b>阅读进度</b><span>阅读进度暂未提供</span></div><div className="h-2 rounded-full bg-slate-100"/></aside></section><div className="xy-series-detail-body"><section className="xy-series-chapters"><div className="xy-series-section-title"><h2><BookOpen/>章节目录</h2><span>{chapters.length} 章</span></div>{chapters.length===0?<EmptyState compact icon={BookOpen} title="暂无章节" description="章节发布后会显示在这里"/>:<ol>{chapters.map((chapter,index)=><li key={chapter.id}><span className="xy-chapter-number">{String(index+1).padStart(2,"0")}</span><div><Link href={`/articles/${chapter.articleId}?seriesId=${seriesId}`}>{chapter.title || `章节 ${chapter.position}`}</Link><p>章节摘要暂未提供。</p></div><span className="xy-chapter-state">章节信息可阅读</span></li>)}</ol>}</section><aside className="space-y-4"><section className="xy-series-note"><h2><MessageCircle/>读者讨论</h2><p>和正在阅读这个系列的人交流。</p><Link href="/topics">进入讨论 →</Link></section></aside></div></main></AppShell>;
}
