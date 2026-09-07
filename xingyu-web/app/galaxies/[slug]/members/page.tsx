"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function GalaxyMembersPage() {
  const { slug: raw } = useParams<{ slug: string }>();
  const slug = decodeURIComponent(raw || "");
  const galaxyState = useAsyncData(() => communityApi.getGalaxy(slug), [slug]);
  const membersState = useAsyncData(() => communityApi.getGalaxyMembers(slug), [slug]);
  const members = membersState.data ?? [];

  return <AppShell><main className="mx-auto w-full max-w-[1420px] px-5 pb-16 pt-7 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#e6e2dc] pb-6">
      <div>
        <Link href={`/galaxies/${encodeURIComponent(slug)}`} className="inline-flex items-center gap-2 text-sm text-[#68758c]"><ArrowLeft className="h-4 w-4"/>返回星系</Link>
        <h1 className="mt-4 text-[2rem] font-bold text-[#142957]">{galaxyState.data?.name || "星系"}成员</h1>
        <p className="mt-2 text-sm text-[#748096]">公开成员与其在星系中的角色</p>
      </div>
      <Link href={`/galaxies/${encodeURIComponent(slug)}/content`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e4ddd4] bg-white/75 px-5 text-sm text-[#263a62]"><FileText className="h-4 w-4"/>浏览内容</Link>
    </header>
    {(galaxyState.error || membersState.error) && <Alert variant="destructive" className="mt-6">{galaxyState.error || membersState.error}</Alert>}
    {membersState.loading ? <p className="py-20 text-center text-sm text-[#778398]">正在加载成员…</p> : members.length ? <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map((member) => <li key={member.userId}><Link href={`/users/${encodeURIComponent(member.username)}`} className="flex min-h-28 items-center gap-4 rounded-2xl border border-[#e8e2da] bg-white/75 p-5 shadow-[0_8px_24px_rgb(36_49_84/.04)] transition hover:border-[#cfd7e8] hover:bg-white"><span className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-[#19315f] text-lg font-semibold text-white">{(member.displayName || member.username).slice(0, 1)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-base text-[#1d315a]">{member.displayName || member.username}</strong><small className="mt-1 block text-sm text-[#7b8698]">@{member.username}</small><span className="mt-2 inline-block rounded-full bg-[#fff0df] px-2.5 py-1 text-xs text-[#c97124]">{member.role || "MEMBER"}</span></span></Link></li>)}</ul> : <div className="mt-6 rounded-2xl border border-[#e8e2da] bg-white/70"><EmptyState title="暂无公开成员" description="成员加入后会根据星系可见性显示在这里" icon={Users}/></div>}
  </main></AppShell>;
}
