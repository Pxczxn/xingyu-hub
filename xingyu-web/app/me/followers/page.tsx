"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Compass, MoreHorizontal, Orbit, Search, Sparkles, UserRound, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type FollowUser } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

type FollowerData = { followers: FollowUser[]; following: FollowUser[]; suggestions: FollowUser[] };

function displayName(user: FollowUser) {
  return user.displayName || user.username;
}

function FollowerAvatar({ user, size = "large" }: { user: FollowUser; size?: "large" | "small" }) {
  const label = displayName(user).trim().slice(0, 1).toUpperCase();
  return (
    <span className={size === "large" ? "grid h-[6.1rem] w-[6.1rem] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_70%_30%,#fff0cb_0_2%,transparent_3%),radial-gradient(circle_at_31%_70%,#7898bd_0_1.5%,transparent_3%),linear-gradient(145deg,#233450,#8498b6)] text-2xl font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/.28)]" : "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_70%_30%,#fff0cb_0_2%,transparent_3%),linear-gradient(145deg,#253a5e,#97a8bf)] text-sm font-semibold text-white"} aria-hidden="true">{label}</span>
  );
}

function JoinedText({ date }: { date?: string }) {
  if (!date) return <span>关注时间暂未记录</span>;
  const parsed = new Date(date);
  return <span>{Number.isNaN(parsed.getTime()) ? "已关注" : `关注于 ${parsed.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}`}</span>;
}

function FollowerCard({ user, followed, pending, onFollow }: { user: FollowUser; followed: boolean; pending: boolean; onFollow: (user: FollowUser) => void }) {
  return (
    <li className="relative grid gap-5 overflow-hidden rounded-[1.45rem] border border-[#eee8df] bg-[rgb(255_254_251/.72)] px-6 py-6 shadow-[0_10px_30px_rgb(38_34_28/.035)] transition-colors hover:border-[#e6d8c3] sm:grid-cols-[6.1rem_minmax(0,1fr)_auto] sm:items-center sm:px-7">
      <span className="pointer-events-none absolute -right-10 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full border border-[#f4e5d2] opacity-80" aria-hidden="true" />
      <FollowerAvatar user={user} />
      <div className="relative min-w-0">
        <Link href={`/users/${user.username}`} className="inline-flex items-center gap-2 text-[1.25rem] font-semibold tracking-[-0.02em] text-[#1b2d52] hover:text-[rgb(var(--violet))]">
          <span className="truncate">{displayName(user)}</span><Sparkles className="h-4 w-4 shrink-0 text-[#e1a04a]" aria-label="关注者" />
        </Link>
        <p className="mt-1 truncate text-[0.93rem] text-[#7b8495]">@{user.username}</p>
        <p className="mt-3 text-[0.92rem] text-[#7c879a]"><JoinedText date={user.followedAt} /></p>
      </div>
      <div className="relative flex items-center gap-3 sm:self-center">
        <Button type="button" variant={followed ? "outline" : "accent"} size="sm" disabled={pending} onClick={() => onFollow(user)} className={followed ? "h-10 rounded-full border-[#e3e1e6] bg-[#f7f7f9] px-5 text-[0.94rem] text-[#6d7789] hover:bg-[#eeeeF2]" : "h-10 rounded-full px-5 text-[0.94rem]"}>{followed ? "已关注" : "关注"}</Button>
        <Link href={`/users/${user.username}`} aria-label={`查看 ${displayName(user)} 的主页`} className="grid h-9 w-9 place-items-center rounded-full text-[#79849a] hover:bg-[#f4f1eb] hover:text-[#34415e]"><MoreHorizontal className="h-5 w-5" /></Link>
      </div>
    </li>
  );
}

function SuggestionRow({ user, followed, pending, onFollow }: { user: FollowUser; followed: boolean; pending: boolean; onFollow: (user: FollowUser) => void }) {
  return <li className="flex items-center gap-3 border-b border-[#e9e2d9] py-4 last:border-0"><FollowerAvatar user={user} size="small"/><div className="min-w-0 flex-1"><Link href={`/users/${user.username}`} className="block truncate text-[0.98rem] font-semibold text-[#26375b] hover:text-[rgb(var(--violet))]">{displayName(user)}</Link><p className="mt-1 truncate text-[0.84rem] text-[#7b8495]">@{user.username}</p></div><Button type="button" variant={followed ? "outline" : "accent"} size="sm" disabled={pending} onClick={() => onFollow(user)} className={followed ? "h-9 shrink-0 rounded-full border-[#e3e1e6] bg-[#f7f7f9] px-4 text-[#6d7789]" : "h-9 shrink-0 rounded-full px-4"}>{followed ? "已关注" : "关注"}</Button></li>;
}

export default function FollowersPage() {
  const [keyword, setKeyword] = useState("");
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncData<FollowerData>(async () => {
    const [followers, following, suggestions] = await Promise.all([communityApi.getMyFollowers(50), communityApi.getMyFollowing(50), communityApi.getSuggestedUsers(5)]);
    return { followers: followers.items, following: following.items, suggestions };
  }, []);
  const following = data?.following ?? [];
  const followingIds = useMemo(() => new Set(following.map((item) => item.userId)), [following]);
  const followers = useMemo(() => (data?.followers ?? []).filter((item) => `${displayName(item)} ${item.username}`.toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase())), [data?.followers, keyword]);
  const suggestions = (data?.suggestions ?? []).filter((item) => !data?.followers.some((follower) => follower.userId === item.userId)).slice(0, 5);

  async function toggleFollow(user: FollowUser) {
    setPendingUsername(user.username);
    try {
      if (followingIds.has(user.userId)) await communityApi.unfollowUser(user.username);
      else await communityApi.followUser(user.username);
      reload();
    } finally { setPendingUsername(null); }
  }

  return <AppShell><main className="mx-auto w-full max-w-[1400px] px-5 pb-16 pt-10 sm:px-8 lg:px-10 lg:pt-12"><div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_22rem]"><section className="rounded-[1.7rem] border border-white/75 bg-[rgb(255_253_249/.73)] px-6 py-8 shadow-[0_18px_44px_rgb(44_36_27/.055)] backdrop-blur-xl sm:px-9"><header className="flex flex-col gap-6 border-b border-[#e8e1d8] pb-7 md:flex-row md:items-start md:justify-between"><div><h1 className="text-[2.6rem] font-semibold tracking-[-0.045em] text-[#172a50]">关注者</h1><p className="mt-2 text-[1.02rem] text-[#7b8495]">关注该创作者的人</p></div><label className="flex h-12 w-full items-center gap-3 rounded-full border border-[#e4e2e6] bg-white/65 px-4 text-[#7d8797] md:w-[19rem]"><Search className="h-5 w-5 shrink-0"/><span className="sr-only">搜索关注者</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索关注者的昵称或账号" className="min-w-0 flex-1 bg-transparent text-[0.94rem] text-[#26375b] outline-none placeholder:text-[#a1a8b3]"/></label></header><div className="flex items-center justify-between py-6"><p className="text-[1.04rem] font-medium text-[#30405e]">共 {data?.followers.length ?? 0} 位关注者</p><span className="text-sm text-[#7d8798]">默认排序</span></div>{loading ? <div className="grid min-h-[36rem] place-items-center"><Orbit className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none"/></div> : error ? <div className="grid min-h-[36rem] place-items-center text-center"><div><h2 className="text-xl font-semibold">关注者暂时无法加载</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button onClick={reload} variant="outline" className="mt-5 rounded-full">重新加载</Button></div></div> : followers.length ? <ul className="space-y-3" role="list">{followers.map((user) => <FollowerCard key={user.userId} user={user} followed={followingIds.has(user.userId)} pending={pendingUsername === user.username} onFollow={(item) => void toggleFollow(item)}/>)}</ul> : <div className="grid min-h-[36rem] place-items-center text-center"><div><UsersRound className="mx-auto h-10 w-10 text-[#d49b52]"/><h2 className="mt-4 text-xl font-semibold text-[#26375b]">{keyword ? "没有匹配的关注者" : "暂无关注者"}</h2><p className="mt-2 text-[0.94rem] text-[#7b8495]">{keyword ? "换个关键词再试试。" : "发布公开内容后，关注者会在这里出现。"}</p>{!keyword && <Button asChild className="mt-5 rounded-full"><Link href="/studio">开始创作</Link></Button>}</div></div>}</section><aside className="space-y-5"><section className="rounded-[1.45rem] border border-white/75 bg-[rgb(255_253_249/.78)] px-6 py-6 shadow-[0_16px_40px_rgb(44_36_27/.05)] backdrop-blur-xl"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff0df] text-[#d79039]"><Sparkles className="h-4 w-4"/></span><h2 className="text-[1.16rem] font-semibold text-[#26375b]">互动小贴士</h2></div><ul className="mt-5 space-y-5 text-[0.9rem] leading-6 text-[#7b8495]"><li><strong className="block text-[#394865]">真诚互动</strong>积极回应评论，让交流持续发生。</li><li><strong className="block text-[#394865]">持续分享</strong>稳定的公开创作能连接更多同好。</li><li><strong className="block text-[#394865]">参与话题</strong>在共同话题中留下你的观点。</li></ul></section><section className="rounded-[1.45rem] border border-white/75 bg-[rgb(255_253_249/.78)] px-6 py-6 shadow-[0_16px_40px_rgb(44_36_27/.05)] backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><h2 className="text-[1.16rem] font-semibold text-[#26375b]">推荐关注</h2><span className="inline-flex items-center gap-1 text-sm text-[#7d8798]"><Compass className="h-4 w-4"/>推荐</span></div>{loading ? <div className="grid min-h-[16rem] place-items-center"><Orbit className="h-6 w-6 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none"/></div> : suggestions.length ? <ul>{suggestions.map((user) => <SuggestionRow key={user.userId} user={user} followed={followingIds.has(user.userId)} pending={pendingUsername === user.username} onFollow={(item) => void toggleFollow(item)}/>)}</ul> : <p className="py-10 text-center text-sm text-[#7b8495]">暂无新的创作者推荐</p>}<Link href="/discover" className="mt-3 flex justify-center border-t border-[#e9e2d9] pt-5 text-[0.94rem] font-medium text-[#34415e] hover:text-[rgb(var(--violet))]">查看全部推荐 <span className="ml-2" aria-hidden="true">›</span></Link></section></aside></div></main></AppShell>;
}
