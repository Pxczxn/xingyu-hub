"use client";

import Link from "next/link";
import { Home, Share2 } from "lucide-react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function AnnouncementDetailPage() {
  const { announcementId } = useParams<{ announcementId: string }>();
  const { data, loading, error } = useAsyncData(() => communityApi.getAnnouncement(announcementId), [announcementId]);
  const { data: related } = useAsyncData(() => communityApi.getAnnouncements(6), []);

  async function shareAnnouncement() {
    const shareData = { title: data?.title || "社区公告", url: window.location.href };
    if (navigator.share) await navigator.share(shareData);
    else await navigator.clipboard.writeText(window.location.href);
  }

  if (loading) return <AppShell><main className="py-28 text-center text-[#748096]">正在加载公告…</main></AppShell>;
  if (error || !data) return <AppShell><main className="py-28 text-center text-red-500">{error || "公告不存在"}</main></AppShell>;

  return <AppShell>
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_20%,rgba(251,214,159,.3),transparent_26%),linear-gradient(135deg,#fdf8ef,#fbf2e4)] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1420px] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-[24px] border border-white/90 bg-white/75 p-7 shadow-[0_16px_38px_rgba(78,60,34,.08)] sm:p-9">
          <nav className="flex items-center gap-2 text-[13px] text-[#657187]"><Home className="h-4 w-4"/><Link href="/">首页</Link><span>›</span><Link href="/announcements">社区公告</Link><span>›</span><span>公告详情</span></nav>
          <header className="mt-10"><span className="rounded-full bg-[#fff0df] px-3 py-1.5 text-[13px] text-[#dc822c]">社区公告</span><h1 className="mt-5 text-[34px] font-bold leading-[1.28] text-[#162d58]">{data.title}</h1><p className="mt-4 text-[14px] text-[#68748b]">{data.publishedAt ? formatDateTime(data.publishedAt) : "发布时间暂未提供"}</p></header>
          <div className="my-7 flex items-center gap-3 text-[#e59a45]"><i className="h-px flex-1 bg-[#ead9c3]"/><span>✦</span><i className="h-px flex-1 bg-[#ead9c3]"/></div>
          <img src="/prototype-assets/announcement-detail/announcement-hero-image.png" alt="" className="w-full rounded-[15px]"/>
          <div className="xy-reading-copy mt-7 whitespace-pre-wrap text-[16px] leading-8 text-[#4f5c73]">{data.body || "该公告暂未提供正文内容。"}</div>
          <footer className="mt-7 flex justify-end border-t border-[#eee5da] pt-5"><button type="button" onClick={() => void shareAnnouncement()} className="flex items-center gap-2 rounded-xl border border-[#e9e2d9] bg-white/55 px-5 py-3 text-[14px] text-[#4c5b75]"><Share2 className="h-4 w-4"/>分享</button></footer>
        </article>
        <aside className="h-fit rounded-[22px] border border-white/90 bg-white/75 p-6 shadow-[0_16px_38px_rgba(78,60,34,.08)]">
          <h2 className="text-[22px] font-semibold text-[#24395f]">相关公告</h2><i className="mt-4 block h-0.5 w-14 bg-[#ea923b]"/>
          <div className="mt-5">{(related ?? []).filter((item) => item.id !== data.id).slice(0, 5).map((item) => <Link className="block border-b border-[#eee6dc] py-5 last:border-0" href={`/announcements/${item.id}`} key={item.id}><h3 className="text-[14px] leading-6 text-[#344565]">{item.title}</h3><p className="mt-2 text-[12px] text-[#8a91a0]">{item.publishedAt ? formatDateTime(item.publishedAt) : "—"}　›</p></Link>)}</div>
          <Link href="/announcements" className="mt-5 flex justify-center rounded-full border border-[#f0d1b0] py-3 text-[13px] text-[#dc832c]">查看更多公告　›</Link>
        </aside>
      </div>
    </main>
  </AppShell>;
}
