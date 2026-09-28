"use client";

import Link from "next/link";
import { Bell, Compass, Home, MessageSquare, PenLine, Search, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams, matchNavActive } from "next/navigation";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidUsername } from "@/lib/paths";
import { cn } from "@/lib/utils";

const mobileItems = [{ href: "/", label: "首页", icon: Home }, { href: "/discover", label: "探索", icon: Compass }, { href: "/studio", label: "创作", icon: PenLine }, { href: "/?openMessages=1", label: "消息", icon: MessageSquare }, { href: "/me", label: "我的", icon: UserRound }] as const;

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [value, setValue] = useState("");

  useEffect(() => {
    if (pathname === "/search") {
      setValue(queryFromUrl);
    }
  }, [pathname, queryFromUrl]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <form
      onSubmit={submit}
      className="relative mx-auto hidden h-9 min-w-0 max-w-sm flex-1 md:block"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="搜索文章、话题、系列或用户"
        aria-label="搜索文章、话题、系列或用户"
        className="h-9 rounded-full border-border bg-background/70 py-0 pl-9 pr-[4.5rem] shadow-none focus-visible:ring-[rgb(var(--violet)/.35)]"
      />
      <Button
        type="submit"
        size="sm"
        className="absolute right-1 top-1/2 h-7 -translate-y-1/2 rounded-full px-3 text-xs"
      >
        搜索
      </Button>
    </form>
  );
}

export function MobileTabBar() { const pathname = usePathname(); const search = useSearchParams().toString(); return <nav aria-label="移动端主导航" className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 rounded-xl border border-white/90 bg-white/95 px-1 py-1.5 shadow-[0_10px_24px_rgb(36_49_84/0.12)] backdrop-blur-xl lg:hidden">{mobileItems.map(item => { const active = matchNavActive(pathname, item.href, search); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("grid min-h-11 place-items-center gap-0.5 rounded-lg py-1.5 text-[11px] transition-colors", active ? "bg-[rgb(var(--violet)/.12)] font-medium text-[rgb(var(--violet))]" : "text-muted-foreground hover:bg-white/60 hover:text-foreground")}><Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span></Link>; })}</nav>; }

export function NotificationItem({ title, body, createdAt, read, href = "/", onClick }: { title: string; body: string; createdAt: string; read: boolean; href?: string; onClick?: () => void }) { return <Link href={href} onClick={onClick} className={cn("flex gap-3 border-b border-border px-4 py-4 last:border-0 hover:bg-muted", !read && "bg-[rgb(var(--violet)/.045)]")}><Bell className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--violet))]" /><span className="min-w-0"><span className="flex items-center justify-between gap-3"><strong className="truncate text-sm">{title}</strong><time className="shrink-0 text-xs text-muted-foreground">{createdAt}</time></span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{body}</span></span></Link>; }

export function UserMenuItems({
  username,
  onNavigate,
}: {
  username?: string;
  onNavigate: (href: string) => void;
}) {
  const profileHref = isValidUsername(username) ? `/u/${username}` : "/me";
  return (
    <>
      <DropdownMenuItem onSelect={() => onNavigate(profileHref)}>个人主页</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onNavigate("/me/bookshelf")}>我的书架</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onNavigate("/studio")}>创作工作台</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onNavigate("/settings/profile")}>设置</DropdownMenuItem>
    </>
  );
}
