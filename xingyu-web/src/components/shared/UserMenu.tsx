import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * The header's user entry — a disclosure menu, matching the prototype's 用户菜单.
 *
 * The shell used to render every /me/* shortcut INLINE in the top bar: fourteen links
 * (收藏夹 / 书架 / 关注 / 我的动态 / 我的喜欢 / 我的评论 / 徽章 / 成长 / 关系请求 / 我的探索 /
 * 我的群聊 / 收藏的私信 / 我的星系 / 举报与申诉) plus 退出. On a real screen that is a wall of
 * text across the header, and the prototype shows a single user entry instead. Collapsing them
 * here keeps every destination reachable while restoring the header the design asks for.
 *
 * WHY A DISCLOSURE AND NOT `role="menu"`: a menu role promises arrow-key roving focus and an
 * active-descendant model. This is a plain list of navigation links behind a toggle, so
 * `aria-expanded` / `aria-controls` describes it honestly. Escape and click-outside close it,
 * and focus returns to the trigger on Escape — the parts a keyboard user actually needs.
 *
 * ⚠️ THIS MENU IS THE ONLY ENTRY POINT for most of these routes. Adding a link here is adding
 * its entry point; removing one orphans a page. (A route with no entry point is exactly how
 * 动态 ended up needing its own nav slot in Phase 2H.)
 *
 * `我的主页` is first because the trigger is a button, not a link — without it there would be
 * no way to reach your own profile from the header.
 */

type MenuGroup = {
  heading: string;
  items: { label: string; to: string }[];
};

const GROUPS: MenuGroup[] = [
  {
    heading: "我的内容",
    items: [
      { label: "收藏夹", to: "/me/collections" },
      { label: "书架", to: "/me/bookshelf" },
      { label: "我的动态", to: "/me/moments" },
      { label: "我的群聊", to: "/me/groups" },
      { label: "收藏的私信", to: "/messages/saved" },
      { label: "我的星系", to: "/me/galaxies" },
    ],
  },
  {
    heading: "我的互动",
    items: [
      // 关注 is the follow GRAPH, not a feed — the public 动态 feed lives in the main nav.
      { label: "关注", to: "/me/following" },
      { label: "我的喜欢", to: "/me/likes" },
      { label: "我的评论", to: "/me/comments" },
      // Only group join requests can appear here: following is open, so no follow request exists.
      { label: "关系请求", to: "/me/requests" },
    ],
  },
  {
    heading: "我的成长",
    items: [
      // Badges are never shown on someone else's profile, so this has no public counterpart.
      { label: "徽章", to: "/me/badges" },
      { label: "成长", to: "/me/growth" },
      { label: "我的探索", to: "/me/interests" },
    ],
  },
  {
    heading: "账号",
    items: [{ label: "举报与申诉", to: "/reports" }],
  },
];

export function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        // Send focus back where it came from, or the next Tab starts from the top of the page.
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        /*
         * The accessible name is the username, stated explicitly rather than
         * inherited from the label below — because that label is hidden on narrow
         * screens (2026-10-03). Without this the trigger would have NO name on a
         * phone, where it is the only way into /me/*.
         */
        aria-label={username}
        aria-expanded={open}
        aria-controls="app-user-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
      >
        <UserIcon className="h-4 w-4" aria-hidden />
        {/*
         * Hidden below `sm`. At 320px the header's action cluster needs 334px and
         * the viewport is 320, so the whole page scrolled sideways by 14px. The
         * username is the widest and least essential thing there — the icon and
         * chevron still read as "your account", and the menu it opens is unchanged.
         */}
        <span className="hidden max-w-32 truncate sm:inline">{username}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id="app-user-menu"
          className="absolute right-0 z-40 mt-2 max-h-[70vh] w-52 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          <ul className="flex flex-col">
            <li>
              <Link
                to="/me"
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                我的主页
              </Link>
            </li>

            {GROUPS.map((group) => (
              <li key={group.heading}>
                <p className="mt-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </p>
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}

            <li className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                退出
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
