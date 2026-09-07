"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, FileText, Plus, Settings, Sparkles, Layers3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type SeriesSummary } from "@/lib/community-api";
export default function StudioSeriesPage() {
  const [series, setSeries] = useState<SeriesSummary[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { communityApi.listMySeries().then(setSeries).catch(() => setError("无法加载系列列表，请确认已登录")).finally(() => setLoading(false)); }, []);
  return <AppShell><main className="xy-series-manager">{error && <Alert variant="destructive">{error}</Alert>}<header><span><h1>系列管理 <Sparkles /></h1><p>管理你的系列作品与章节内容。</p></span><Button asChild><Link href="/studio/series/new"><Plus />新建系列</Link></Button></header><section className="xy-series-stats"><article><BookOpen /><b>{series.length}</b><small>系列总数</small></article><article><FileText /><b>—</b><small>章节总数</small></article><article><BarChart3 /><b>—</b><small>阅读与订阅数据待接入</small></article></section><div className="xy-series-layout"><section className="xy-series-grid">{loading ? <p>正在加载系列…</p> : series.length ? series.map((s, i) => <article key={s.id}><Image src={`/prototype-assets/series-management/series-${(i % 6) + 1}.png`} alt="" aria-hidden="true" width={126} height={209} /><div><h2>{s.title || "未命名系列"}</h2><p>{s.description || "系列简介暂未提供"}</p><b>章节数　{s.chapterCount == null ? "暂未提供" : s.chapterCount}</b><em>{s.status || "状态暂未提供"}</em><small>最近更新<br />{s.updatedAt ? new Date(s.updatedAt).toLocaleString("zh-CN") : "更新时间暂未提供"}</small></div><footer><Link href={`/studio/series/${s.id}/chapters`}><FileText />管理章节</Link><Link href={`/studio/series/${s.id}/edit`}><BarChart3 />数据</Link><Link href={`/studio/series/${s.id}/edit`}><Settings />设置</Link></footer></article>) : <div className="xy-series-empty"><Layers3 /><h2>还没有系列作品</h2><p>把相关文章整理成连续阅读的内容，开始你的第一条系列。</p><Button asChild><Link href="/studio/series/new"><Plus />创建系列</Link></Button></div>}</section><aside><section><header><h2>系列数据</h2></header><p>阅读、订阅和趋势统计将在接口提供后展示。</p></section><section className="xy-series-trend"><h2>创作提示</h2><p>先完善系列简介和章节目录，再开始持续更新。</p></section></aside></div></main></AppShell>;
}
