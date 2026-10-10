import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

type MenuGroup = { heading: string; items: { label: string; to: string }[] };

const GROUPS: MenuGroup[] = [
  { heading: "内容", items: [
    { label: "我的内容", to: "/studio/content" }, { label: "收藏夹", to: "/me/collections" },
    { label: "书架", to: "/me/bookshelf" }, { label: "我的动态", to: "/me/moments" }, { label: "我的星系", to: "/me/galaxies" },
  ] },
  { heading: "社交", items: [
    /*
     * 2026-10-06: 「收藏的私信」入口暂时下线。
     *
     * `save` / `remove` API 与 `/messages/saved` 路由都还在，route 与后端也保留 ——
     * 但消息 UI 里**没有任何收藏动作**（实测 `savedMessagesApi.save` 全站无调用者），
     * 所以这一页的内容用户根本进不去，挂着入口只是让人点进一个永远空的页面。
     * 本轮不为它新增 context menu / 收藏按钮 / swipe / 更多菜单；等
     * Saved Messages Product Phase 有了真正的保存动作再恢复入口。
     */
    { label: "我的群聊", to: "/me/groups" },
    { label: "我的互动", to: "/me/comments" },
    { label: "关注", to: "/me/following" }, { label: "我的喜欢", to: "/me/likes" }, { label: "我的评论", to: "/me/comments" }, { label: "关系请求", to: "/me/requests" },
  ] },
  /*
   * 成长：加入「我的活动」。
   *
   * `/me/events` 此前只能从活动详情页的侧栏进入，用户在别处找不到自己的活动记录。
   * 它属于"我参与过什么"这一类，放进成长组最贴近现有信息架构；不进 PRIMARY_NAV
   * （那是七个全局入口），也不新开活动工作区——只是给已有页面一个稳定入口。
   */
  { heading: "成长", items: [{ label: "我的成长", to: "/me/growth" }, { label: "我的活动", to: "/me/events" }, { label: "徽章", to: "/me/badges" }] },
  /*
   * 治理：最小、诚实的入口。
   *
   * 不叫"治理中心" —— 那会暗示存在一个聚合控制台，而实际上只有两件事：你举报过什么
   * （处理到哪一步了），以及你对处置的申诉结果。所以这里是"我的举报 / 我的申诉"，
   * 指向已有的 /reports 与 /appeals 路径，不做额外的 landing 页。
   */
  { heading: "治理", items: [{ label: "我的举报", to: "/reports" }, { label: "我的申诉", to: "/appeals" }] },
];

function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || "星"; }

export function UserMenu({ username, displayName, avatarUrl, onLogout }: {
  username: string; displayName?: string; avatarUrl?: string | null; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = displayName?.trim() || username;
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const avatar = avatarUrl ? <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> :
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(name)}</span>;
  return <div ref={containerRef} className="relative">
    <button ref={triggerRef} type="button" aria-label={`${name}，打开账户菜单`} aria-expanded={open} aria-controls="app-user-menu" onClick={() => setOpen((v) => !v)} className="focus-ring flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-sunken">
      {avatar}<span className="hidden max-w-32 truncate font-medium sm:inline">{name}</span><ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
    </button>
    {open ? <div id="app-user-menu" className="absolute right-0 z-40 mt-2 w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <Link to="/me" onClick={() => setOpen(false)} className="focus-ring flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-sunken">
        {avatar}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{name}</span><span className="block truncate text-xs text-muted-foreground">@{username}</span></span><span className="ml-auto text-xs text-muted-foreground">查看主页</span>
      </Link>
      <nav aria-label="个人功能" className="max-h-[calc(100vh-13rem)] overscroll-contain overflow-y-auto px-2 py-1.5">
        {GROUPS.map((group, index) => <section key={group.heading} className={cn(index > 0 && "mt-1.5 border-t border-border pt-1.5")}>
          <h2 className="px-2 pb-1 pt-1 text-[11px] font-semibold tracking-wide text-muted-foreground">{group.heading}</h2>
          {group.items.map((item) => <Link key={`${item.label}-${item.to}`} to={item.to} onClick={() => setOpen(false)} className="focus-ring block rounded-md px-2 py-1.5 text-sm leading-5 text-foreground hover:bg-surface-sunken">{item.label}</Link>)}
        </section>)}
      </nav>
      <div className="border-t border-border px-2 py-1.5">
        <Link to="/settings" onClick={() => setOpen(false)} className="focus-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-surface-sunken"><Settings className="h-4 w-4 text-muted-foreground" aria-hidden />设置</Link>
        <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-surface-sunken hover:text-foreground"><LogOut className="h-4 w-4" aria-hidden />退出登录</button>
      </div>
    </div> : null}
  </div>;
}
