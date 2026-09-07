"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  BookMarked,
  ChevronDown,
  Compass,
  Orbit,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { communityApi, type FollowUser, type GalaxySummary } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

type FollowingData = {
  creators: FollowUser[];
  suggestions: FollowUser[];
  galaxies: GalaxySummary[];
};

const initials = (user: FollowUser) => (user.displayName || user.username).trim().slice(0, 1).toUpperCase();

function CreatorAvatar({ user, tone = "night" }: { user: FollowUser; tone?: "night" | "dawn" }) {
  return (
    <span
      className={
        tone === "night"
          ? "grid h-[4.9rem] w-[4.9rem] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#7992bb_0_2%,transparent_3%),radial-gradient(circle_at_66%_38%,#d9c9a8_0_1.4%,transparent_2.4%),linear-gradient(145deg,#0b1832,#234b73)] text-xl font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/.2)]"
          : "grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_68%_30%,#fff4d0_0_2%,transparent_3%),linear-gradient(145deg,#405983,#a7b7cf)] text-base font-semibold text-white"
      }
      aria-hidden="true"
    >
      {initials(user)}
    </span>
  );
}

function formatFollowedAt(value?: string) {
  if (!value) return "关注时间暂未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已关注";
  return `关注于 ${date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}`;
}

function CreatorRow({ user, onUnfollow, pending }: { user: FollowUser; onUnfollow: (user: FollowUser) => void; pending: boolean }) {
  return (
    <li className="grid gap-4 border-b border-[#e7e0d7] py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_12.5rem_7.1rem] md:items-center md:gap-6">
      <div className="flex min-w-0 items-center gap-5">
        <CreatorAvatar user={user} />
        <div className="min-w-0">
          <Link href={`/users/${user.username}`} className="inline-flex max-w-full items-center gap-1.5 text-[1.06rem] font-semibold text-[#1e3159] hover:text-[rgb(var(--violet))]">
            <span className="truncate">{user.displayName || user.username}</span>
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#d49745]" aria-label="已关注创作者" />
          </Link>
          <p className="mt-1 text-[0.88rem] text-[#79849a]">@{user.username}</p>
          <p className="mt-2 text-[0.9rem] leading-6 text-[#7b8495]">关注其公开创作与社区动态。</p>
        </div>
      </div>
      <div className="border-l border-[#ece5dc] pl-5 md:min-h-[3.75rem]">
        <p className="text-xs text-[#9ba2ae]">关注状态</p>
        <p className="mt-1 text-[0.9rem] font-medium text-[#33415e]">{formatFollowedAt(user.followedAt)}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onUnfollow(user)}
        disabled={pending}
        className="h-10 w-full rounded-xl border-[#d99a45] bg-transparent px-3 text-[0.94rem] font-medium text-[#b76f1c] hover:bg-[#fff7ec] hover:text-[#98570f]"
      >
        已关注 <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    </li>
  );
}

function SuggestedCreator({ user, onFollow, pending }: { user: FollowUser; onFollow: (user: FollowUser) => void; pending: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-[#e7e0d7] py-5 last:border-0">
      <CreatorAvatar user={user} tone="dawn" />
      <div className="min-w-0 flex-1">
        <Link href={`/users/${user.username}`} className="block truncate text-[0.98rem] font-semibold text-[#26375b] hover:text-[rgb(var(--violet))]">
          {user.displayName || user.username}
        </Link>
        <p className="mt-1 truncate text-[0.84rem] text-[#7b8495]">@{user.username}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onFollow(user)}
        disabled={pending}
        className="h-9 shrink-0 rounded-xl border-[#d99a45] bg-transparent px-4 text-[0.9rem] font-medium text-[#b76f1c] hover:bg-[#fff7ec]"
      >
        关注
      </Button>
    </li>
  );
}

export default function FollowingPage() {
  const [tab, setTab] = useState("creators");
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncData<FollowingData>(async () => {
    const [following, suggestions, galaxies] = await Promise.all([
      communityApi.getMyFollowing(30),
      communityApi.getSuggestedUsers(5),
      communityApi.getMyGalaxies(),
    ]);
    return { creators: following.items, suggestions, galaxies };
  }, []);

  const creators = data?.creators ?? [];
  const suggestions = (data?.suggestions ?? []).filter((suggestion) => !creators.some((item) => item.userId === suggestion.userId));

  async function changeFollow(user: FollowUser, action: "follow" | "unfollow") {
    setPendingUsername(user.username);
    try {
      if (action === "follow") await communityApi.followUser(user.username);
      else await communityApi.unfollowUser(user.username);
      reload();
    } finally {
      setPendingUsername(null);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1536px] px-5 pb-16 pt-12 sm:px-8 lg:px-10 lg:pt-14">
        <header className="mb-8 max-w-3xl">
          <span className="inline-flex items-center gap-3 text-[#cf974d]" aria-hidden="true">
            <span className="h-px w-7 bg-[#e6c798]" />
            <Sparkles className="h-4 w-4" />
          </span>
          <h1 className="mt-1 text-[2.55rem] font-semibold tracking-[-0.045em] text-[#192d54] sm:text-[3.1rem]">关注管理</h1>
          <p className="mt-2 text-[1.02rem] leading-7 text-[#79849a]">在这里管理你关注的创作者、星系和收藏夹，获取他们的最新动态。</p>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_29rem]">
          <section className="overflow-hidden rounded-[1.35rem] border border-[#e2dbd1] bg-[rgb(255_253_249/.73)] px-5 py-4 shadow-[0_16px_40px_rgb(45_39_29/.055)] backdrop-blur-xl sm:px-6" aria-label="已关注内容">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-[#ddd7cf] bg-transparent p-0 text-[#68758a]">
                <TabsTrigger value="creators" className={`relative min-h-[3.35rem] rounded-none bg-transparent px-2 text-[0.95rem] ${tab === "creators" ? "border-b-2 border-[#d49942] font-semibold text-[#27375b]" : "text-[#68758a]"}`}>关注的创作者</TabsTrigger>
                <TabsTrigger value="galaxies" className={`relative min-h-[3.35rem] rounded-none bg-transparent px-2 text-[0.95rem] ${tab === "galaxies" ? "border-b-2 border-[#d49942] font-semibold text-[#27375b]" : "text-[#68758a]"}`}>关注的星系</TabsTrigger>
                <TabsTrigger value="collections" className={`relative min-h-[3.35rem] rounded-none bg-transparent px-2 text-[0.95rem] ${tab === "collections" ? "border-b-2 border-[#d49942] font-semibold text-[#27375b]" : "text-[#68758a]"}`}>关注的收藏夹</TabsTrigger>
              </TabsList>

              <TabsContent value="creators" className="mt-0">
                {loading ? (
                  <div className="grid min-h-[18rem] place-items-center" aria-busy="true"><Orbit className="h-7 w-7 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" /></div>
                ) : error ? (
                  <div className="grid min-h-[18rem] place-items-center text-center"><div><h2 className="text-lg font-semibold">关注列表暂时无法加载</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button onClick={reload} variant="outline" className="mt-5">重新加载</Button></div></div>
                ) : creators.length ? (
                  <><ul role="list">{creators.map((user) => <CreatorRow key={user.userId} user={user} pending={pendingUsername === user.username} onUnfollow={(item) => void changeFollow(item, "unfollow")} />)}</ul><p className="border-t border-[#e7e0d7] py-4 text-center text-[0.9rem] text-[#7d8798]">已关注 {creators.length} 位创作者</p></>
                ) : (
                  <div className="grid min-h-[18rem] place-items-center text-center"><div><UsersRound className="mx-auto h-10 w-10 text-[#d49b52]" /><h2 className="mt-4 text-xl font-semibold text-[#26375b]">还没有关注创作者</h2><p className="mt-2 text-[0.94rem] text-[#7b8495]">去发现页找到值得长期阅读的创作者。</p><Button asChild className="mt-5 rounded-xl"><Link href="/discover">去发现</Link></Button></div></div>
                )}
              </TabsContent>

              <TabsContent value="galaxies" className="mt-0">
                {loading ? <div className="grid min-h-[18rem] place-items-center"><Orbit className="h-7 w-7 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" /></div> : data?.galaxies.length ? <ul className="divide-y divide-[#e7e0d7] py-2">{data.galaxies.map((galaxy) => <li key={galaxy.id} className="flex items-center justify-between gap-4 py-5"><span><Link href={`/galaxies/${galaxy.slug}`} className="font-semibold text-[#26375b] hover:text-[rgb(var(--violet))]">{galaxy.name}</Link><p className="mt-1 text-sm text-[#7b8495]">{galaxy.memberCount == null ? "成员数量暂未公开" : `${galaxy.memberCount} 位成员`}</p></span><Link href={`/galaxies/${galaxy.slug}`} className="text-sm font-medium text-[#b76f1c]">进入星系</Link></li>)}</ul> : <div className="grid min-h-[18rem] place-items-center text-center"><div><Orbit className="mx-auto h-10 w-10 text-[#d49b52]"/><h2 className="mt-4 text-xl font-semibold text-[#26375b]">还没有加入星系</h2><p className="mt-2 text-[0.94rem] text-[#7b8495]">在星系中找到共同阅读和讨论的人。</p><Button asChild className="mt-5 rounded-xl"><Link href="/galaxies">浏览星系</Link></Button></div></div>}
              </TabsContent>

              <TabsContent value="collections" className="mt-0">
                <div className="grid min-h-[18rem] place-items-center text-center"><div><BookMarked className="mx-auto h-10 w-10 text-[#d49b52]"/><h2 className="mt-4 text-xl font-semibold text-[#26375b]">暂未提供收藏夹关注记录</h2><p className="mt-2 max-w-sm text-[0.94rem] leading-6 text-[#7b8495]">该能力尚未返回可展示的数据。你可以先整理自己的收藏夹。</p><Button asChild variant="outline" className="mt-5 rounded-xl"><Link href="/me/collections">我的收藏夹</Link></Button></div></div>
              </TabsContent>
            </Tabs>
          </section>

          <aside className="rounded-[1.35rem] border border-[#e2dbd1] bg-[rgb(255_253_249/.76)] px-6 pb-4 pt-7 shadow-[0_16px_40px_rgb(45_39_29/.055)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3"><h2 className="text-[1.2rem] font-semibold text-[#23345a]">发现更多优秀创作者</h2><span className="inline-flex items-center gap-1 text-sm text-[#7d8798]"><Compass className="h-4 w-4" /> 推荐</span></div>
            {loading ? <div className="grid min-h-[14rem] place-items-center"><Orbit className="h-6 w-6 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" /></div> : suggestions.length ? <ul role="list">{suggestions.map((user) => <SuggestedCreator key={user.userId} user={user} pending={pendingUsername === user.username} onFollow={(item) => void changeFollow(item, "follow")} />)}</ul> : <div className="grid min-h-[14rem] place-items-center text-center"><div><UserRound className="mx-auto h-8 w-8 text-[#d49b52]"/><p className="mt-3 text-sm text-[#7b8495]">暂时没有新的创作者推荐</p></div></div>}
            <Link href="/discover" className="mt-2 flex items-center justify-center gap-2 border-t border-[#e7e0d7] py-5 text-[0.96rem] font-medium text-[#34415e] hover:text-[rgb(var(--violet))]">查看全部创作者 <span aria-hidden="true">›</span></Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
