import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

type MenuGroup = { heading: string; items: { label: string; to: string }[] };

const GROUPS: MenuGroup[] = [
  {
    heading: "内容",
    items: [
      { label: "我的内容", to: "/studio/content" },
      { label: "收藏夹", to: "/me/collections" },
      { label: "书架", to: "/me/bookshelf" },
      { label: "我的动态", to: "/me/moments" },
      { label: "我的星系", to: "/me/galaxies" },
    ],
  },
  {
    heading: "社交",
    items: [
      /*
       * 2026-10-06: 「收藏的私信」入口暂时下线。
       *
       * `save` / `remove` API 与 `/messages/saved` 路由都还在，route 与后端也保留 ——
       * 但消息 UI 里**没有任何收藏动作**（实测 `savedMessagesApi.save` 全站无调用者），
       * 所以这一页的内容用户根本进不去，挂着入口只是让人点进一个永远空的页面。
       * 本轮不为它新增 context menu / 收藏按钮 / swipe / 更多菜单；等
       * Saved Messages Product Phase 有了真正的保存动作再恢复入口。
       *
       * 2026-11-10 (浮层统一 2/3): 「我的互动」与「我的评论」原本都指向
       * `/me/comments`（审计 bugs-links §4 的重复入口）。保留「我的评论」不动，
       * 把前者换成「我的粉丝」→ `/me/followers`：`/me/followers` 是真实路由
       * （`router/routes.tsx` 的 MyFollowersPage），此前在菜单里没有任何入口，
       * 且与「关注」构成一对，语义上正属于这个「社交」组。
       * 没有按任务卡的示例改成「我的点赞」→ `/me/likes`，因为「我的喜欢」已经
       * 指向 `/me/likes`（见下一个菜单项），那样只是把一个重复换成了另一个。
       */
      { label: "我的群聊", to: "/me/groups" },
      { label: "我的粉丝", to: "/me/followers" },
      { label: "关注", to: "/me/following" },
      { label: "我的喜欢", to: "/me/likes" },
      { label: "我的评论", to: "/me/comments" },
      { label: "关系请求", to: "/me/requests" },
    ],
  },
  /*
   * 成长：加入「我的活动」。
   *
   * `/me/events` 此前只能从活动详情页的侧栏进入，用户在别处找不到自己的活动记录。
   * 它属于"我参与过什么"这一类，放进成长组最贴近现有信息架构；不进 PRIMARY_NAV
   * （那是七个全局入口），也不新开活动工作区——只是给已有页面一个稳定入口。
   */
  {
    heading: "成长",
    items: [
      { label: "我的成长", to: "/me/growth" },
      { label: "我的活动", to: "/me/events" },
      { label: "徽章", to: "/me/badges" },
    ],
  },
  /*
   * 治理：最小、诚实的入口。
   *
   * 不叫"治理中心" —— 那会暗示存在一个聚合控制台，而实际上只有两件事：你举报过什么
   * （处理到哪一步了），以及你对处置的申诉结果。所以这里是"我的举报 / 我的申诉"，
   * 指向已有的 /reports 与 /appeals 路径，不做额外的 landing 页。
   */
  {
    heading: "治理",
    items: [
      { label: "我的举报", to: "/reports" },
      { label: "我的申诉", to: "/appeals" },
    ],
  },
];

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "星";
}

/*
 * The header's account menu — components/ui/dropdown-menu (Radix) since the
 * 浮层统一 2/3 pass.
 *
 * What moved to Radix: open/close state, Escape, outside-click dismissal, focus
 * management, roving arrow-key navigation and returning focus to the trigger on
 * close. The previous hand-written version re-implemented the first three with
 * document listeners; they are gone.
 *
 * Two deliberate compatibility details, because the surrounding contract (and
 * its tests) predate Radix:
 *
 *  1. `modal={false}`. A modal Radix menu runs `aria-hidden` over the rest of
 *     the app while open — including this trigger — which would make the
 *     expanded/collapsed state invisible to assistive tech. The previous menu
 *     was a plain disclosure, not a modal, and there is no reason for the page
 *     behind it to become inert.
 *  2. Items keep their ORIGINAL accessible roles: navigation entries stay
 *     `role="link"` (they render a real <Link> via asChild) and logout stays
 *     `role="button"`. Radix still owns focus/selection on those items; only the
 *     announced role is pinned, so the long-standing "these are links" contract
 *     (and the tests that assert hrefs by role) is unchanged.
 *
 * The duplicate-destination fix is documented in the 社交 group above.
 */
export function UserMenu({
  username,
  displayName,
  avatarUrl,
  onLogout,
}: {
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /*
   * Radix opens a dropdown from `pointerdown`, not `click`. This flag lets the
   * click handler below serve two masters without double-toggling: a real
   * pointer sequence is handled entirely by Radix (the flag swallows the
   * follow-up click), while a bare click — keyboard/programmatic, and what the
   * test environment dispatches — toggles the menu itself.
   */
  const pointerDownRef = useRef(false);
  const name = displayName?.trim() || username;

  /*
   * Escape / outside dismissal are Radix's job. This one extra `mousedown`
   * listener only mirrors the old contract for environments whose pointer
   * events do not reach Radix's document listener (happy-dom dispatches
   * `mousedown` where a browser would send `pointerdown`); in a browser it is a
   * harmless no-op because the menu has already closed by then.
   */
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const avatar = avatarUrl ? (
    <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {initials(name)}
    </span>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${name}，打开账户菜单`}
          onPointerDown={() => {
            pointerDownRef.current = true;
          }}
          onClick={() => {
            if (pointerDownRef.current) {
              pointerDownRef.current = false;
              return;
            }
            setOpen((value) => !value);
          }}
          className="focus-ring flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-sunken"
        >
          {avatar}
          <span className="hidden max-w-32 truncate font-medium sm:inline">{name}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(19rem,calc(100vw-1rem))] flex-col overflow-hidden overflow-x-hidden overflow-y-hidden p-0"
        /*
         * Radix restores focus to the trigger from the FocusScope unmount
         * effect, which runs in a macrotask. The shell's long-standing contract
         * (and its test) is that Escape puts focus back on the trigger
         * synchronously, so do it here as well — Radix then closes the menu as
         * usual.
         */
        onEscapeKeyDown={() => triggerRef.current?.focus()}
      >
        <DropdownMenuItem
          asChild
          role="link"
          className="shrink-0 rounded-none border-b border-border px-4 py-3 focus:bg-surface-sunken focus:text-foreground"
        >
          <Link to="/me" onClick={() => setOpen(false)}>
            {avatar}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{username}</span>
            </span>
            <span className="ml-auto text-xs text-muted-foreground">查看主页</span>
          </Link>
        </DropdownMenuItem>

        {/*
         * Only the destination list scrolls. The profile row above and the
         * settings/logout block below stay pinned, which is the shape this menu
         * has always had (a menu that needs a scroll to reach 退出登录 would hide
         * its most common exit).
         */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5">
          {GROUPS.map((group, index) => (
            <DropdownMenuGroup key={group.heading}>
              {index > 0 ? <DropdownMenuSeparator className="my-1.5 bg-border" /> : null}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-md px-2 py-2 focus:bg-surface-sunken focus:text-foreground">
                  <span className="font-medium">{group.heading}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48"
                  sideOffset={8}
                >
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={`${item.label}-${item.to}`}
                      asChild
                      role="link"
                      className="rounded-md px-2 py-1.5 leading-5 focus:bg-surface-sunken focus:text-foreground"
                    >
                      <Link to={item.to} onClick={() => setOpen(false)}>
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          ))}
        </div>

        <DropdownMenuSeparator className="my-0 shrink-0 bg-border" />
        <div className="shrink-0 px-2 py-1.5">
          <DropdownMenuItem
            asChild
            role="link"
            className="rounded-md px-2 py-1.5 focus:bg-surface-sunken focus:text-foreground"
          >
            <Link to="/settings" onClick={() => setOpen(false)}>
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
              设置
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            role="button"
            onSelect={onLogout}
            className="w-full rounded-md px-2 py-1.5 focus:bg-surface-sunken focus:text-foreground"
          >
            <button type="button">
              <LogOut className="h-4 w-4" aria-hidden />
              退出登录
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
