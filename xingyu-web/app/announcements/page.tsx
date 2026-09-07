"use client";

import Link from "next/link";
import { Bell, Megaphone, Wrench } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const announcementIcons = [Megaphone, Bell, Wrench];

export default function AnnouncementsPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getAnnouncements(), []);
  const [query, setQuery] = useState("");
  const items = (data ?? []).filter((item) => `${item.title} ${item.body || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pinned = items[0];

  return <AppShell><main className="xy-announcement-real">
    <div className="xy-announcement-real-inner">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <header className="xy-announcement-real-heading"><h1>公告中心</h1><p>社区官方信息发布与重要通知</p></header>
      <div className="xy-announcement-real-layout"><section className="xy-announcement-real-list"><header><div><h2>全部公告</h2><small>{data?.length ?? 0} 条已发布公告</small></div><label><span className="sr-only">搜索公告</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公告" /></label></header>{loading ? <p className="xy-announcement-real-status">正在加载公告…</p> : null}{!loading && !items.length ? <EmptyState title="暂无公告" description={query ? "没有匹配的公告。" : "有新公告时会在此发布。"} /> : null}{items.map((item, index) => { const Icon = announcementIcons[index % announcementIcons.length]; return <Link href={`/announcements/${encodeURIComponent(item.id)}`} key={item.id} className="xy-announcement-real-item"><i><Icon /></i><span><h2>{item.title}</h2>{item.body ? <p>{item.body}</p> : <p>查看详情以了解本条公告的完整内容。</p>}</span><time>{item.publishedAt ? formatDateTime(item.publishedAt) : "—"}</time></Link>; })}</section><aside className="xy-announcement-real-side"><section><h2>置顶公告</h2><Link href={pinned ? `/announcements/${encodeURIComponent(pinned.id)}` : "/announcements"} className="xy-announcement-real-pinned"><img src="/prototype-assets/announcements/pinned-announcement-cover.png" alt="" /><span>{pinned?.title || "暂无可置顶公告"}</span></Link></section><section><h2>公告概览</h2><p><Bell />当前公开公告<span>{data?.length ?? 0} 条</span></p><p><Megaphone />最近发布<span>{pinned?.publishedAt ? formatDateTime(pinned.publishedAt) : "—"}</span></p><p><Wrench />公告说明<span>以详情页为准</span></p></section></aside></div>
    </div>
  </main></AppShell>;
}
