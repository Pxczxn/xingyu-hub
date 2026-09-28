"use client";

import Link from "next/link";
import { BookOpen, Clock3, Library, PenLine } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

const coverAssets = [
  "/prototype-assets/bookshelf/image-book-cover-01.png",
  "/prototype-assets/bookshelf/image-book-cover-02.png",
  "/prototype-assets/bookshelf/image-book-cover-03.png",
  "/prototype-assets/bookshelf/image-book-cover-04.png",
];

export default function BookshelfPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getBookshelf(), []);
  const items = data?.items ?? [];

  return (
    <AppShell>
      <main className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 lg:px-8">
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <header className="relative min-h-[178px] overflow-hidden rounded-[28px] border border-white/80 bg-white/60 p-9 shadow-[0_12px_35px_rgba(85,64,35,.07)]">
              <img src="/prototype-assets/bookshelf/illustration-hero-globe-01.png" alt="" className="absolute bottom-0 right-3 h-[174px] w-[331px] object-contain opacity-80" />
              <h1 className="relative text-[42px] font-bold tracking-[.08em] text-[#17305c]">我的书架</h1>
              <p className="relative mt-4 text-lg text-slate-500">记录你的阅读轨迹，收藏思想的星光</p>
            </header>

            <section className="mt-5 rounded-[28px] border border-white/80 bg-white/72 p-7 shadow-[0_12px_35px_rgba(85,64,35,.07)]">
              <nav className="flex items-center gap-9 border-b border-[#ebe3d9] pb-4 text-lg font-semibold text-[#344568]" aria-label="书架状态">
                <span>想读</span><span aria-current="page" className="-mb-[17px] border-b-[3px] border-[#e58a31] pb-4 text-[#1d315d]">在读</span><span>已读</span>
              </nav>
              {loading ? <p className="py-20 text-center text-sm text-slate-400">正在加载书架…</p> : error ? <EmptyState title="需要登录" description={error} actionLabel="去登录" actionHref="/login" /> : !items.length ? <EmptyState title="书架为空" description="将内容加入收藏夹后会显示在这里" actionLabel="管理收藏夹" actionHref="/me/collections" /> : <>
                <div className="mt-7 grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
                  {items.slice(0, 4).map((item, index) => (
                    <Link key={item.id} href={contentHref(item)} className="group rounded-[20px] border border-[#eee5db] bg-[#fffdf9] p-3 shadow-[0_8px_22px_rgba(85,64,35,.07)] transition-transform hover:-translate-y-1">
                      <img src={coverAssets[index]} alt="" className="aspect-[.79] w-full rounded-xl object-cover shadow-inner" />
                      <h2 className="mt-4 truncate text-xl font-bold text-[#24375f]">{item.title}</h2>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{item.summary || "暂无内容摘要"}</p>
                      <p className="mt-5 text-xs text-slate-400">已加入书架</p>
                    </Link>
                  ))}
                </div>
                <div className="mt-7 text-center"><Link href="/me/collections" className="inline-flex items-center gap-2 rounded-full border border-[#e4d7c7] bg-white px-6 py-3 text-sm font-semibold text-[#d87824]"><Library className="h-4 w-4" />管理书架</Link></div>
              </>}
            </section>
          </section>

          <aside className="rounded-[28px] border border-white/80 bg-white/75 p-7 shadow-[0_12px_35px_rgba(85,64,35,.07)]">
            <h2 className="text-2xl font-bold text-[#1d315d]">阅读目标</h2>
            <div className="mt-6 border-y border-[#ede4d9] py-6"><div className="flex items-center gap-5"><div className="grid h-30 w-30 place-items-center rounded-full border-[9px] border-[#eadfd1] text-lg font-serif text-[#a78261]">待设置</div><div><p className="text-sm text-slate-500">年度目标</p><p className="mt-2 text-xl font-semibold text-[#263961]">尚未设置</p><p className="mt-2 text-sm text-slate-500">设置目标后，在这里查看进度</p></div></div></div>
            <div className="mt-7"><h3 className="text-lg font-bold text-[#263961]">阅读数据</h3><dl className="mt-5 space-y-5 text-sm"><ReadingRow icon={BookOpen} label="书架内容" value={`${items.length} 篇`} /><ReadingRow icon={Clock3} label="阅读时长" value="暂无记录" /></dl></div>
            <Link href="/studio" className="mt-9 flex h-13 items-center justify-center gap-2 rounded-full bg-[#df8732] font-semibold text-white"><PenLine className="h-4 w-4" />记录阅读笔记</Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function ReadingRow({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-3 text-slate-500"><Icon className="h-4 w-4" />{label}</span><b className="text-lg text-[#203561]">{value}</b></div>;
}
