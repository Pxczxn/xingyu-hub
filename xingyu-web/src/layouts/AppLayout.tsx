import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageState } from "@/components/shared/PageState";
import { UserMenu } from "@/components/shared/UserMenu";
import { PageErrorBoundary } from "@/components/shared/RouteErrorPage";
import { NotificationToaster } from "@/features/notifications/toast/NotificationToaster";
import { useNotificationToasts } from "@/features/notifications/toast/notification-toast.context";
import {
  Bell,
  BookOpen,
  Compass,
  Hash,
  Home,
  Mail,
  Map,
  Menu,
  MessageCircle,
  Orbit,
  PenLine,
  Search,
  X,
} from "lucide-react";
import { homeApi } from "@/api/home/home.api";
import { messagesApi } from "@/api/messages/messages.api";
import { countUnreadConversations, toConversations } from "@/api/messages/messages.types";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";

/*
 * App shell for Web V2.
 * Follows docs/design-system/MASTER.md "Shell": global nav, search,
 * 创作 -> /studio, user entry -> profile. Navigation uses React Router <Link>.
 * Icons come from lucide-react (no emoji used as real icons).
 *
 * Phase 2I-2: the notification entry is now a REAL link to /notifications, with
 * a live unread badge. It used to be an absent placeholder — the old note here
 * read "Message/notification panels are deliberately NOT implemented this
 * round", which meant the shell had no notification entry at all.
 *
 * Phase 2I-3 landed the message centre, so the 私信 entry is now a REAL link to
 * /messages with its own unread count. (A stale comment here claimed the inbox
 * was unbuilt and the icon deliberately absent — both had stopped being true.)
 *
 * 2026-09-29: the user entry became a MENU (components/shared/UserMenu.tsx) instead of the
 * fourteen /me/* links that used to sit inline in the header. The prototype's header ends at
 * 创作 / 通知 / 私信 / 用户菜单, and a wall of links is not a user menu. That component is now
 * the ONLY entry point for those routes — read its header before changing it.
 *
 * 2026-10-03 (layout pass) — three shell defects, all measured:
 *
 *   1. The shell had NO mobile navigation. The nav was `hidden md:flex` and the
 *      search `hidden lg:block`, with no disclosure control anywhere, so below
 *      768px the only reachable destinations were the logo, 创作 (hidden under
 *      640px too) and 登录/注册. Five of the seven nav destinations were simply
 *      unreachable on a phone. `MobileNav` below fixes that.
 *   2. The search box was a native `<form action="/search" method="get">`. That
 *      is a real document navigation: it tore down the SPA, re-downloaded the
 *      entry bundle and dropped the chat socket opened at the bottom of this
 *      file. `/search` already reads `?q=` through `useSearchParams`, so the
 *      route contract is unchanged — only the submit handler needed to change.
 *   3. No skip link, so a keyboard user tabbed through the whole header on every
 *      route before reaching content.
 *
 * The mobile panel is rendered CONDITIONALLY, not hidden with CSS. Two reasons:
 * the DOM stays honest (no duplicate nav landmarks for assistive tech), and the
 * route tests that query `getByRole("link", { name: "发现" })` would otherwise
 * match two nodes and fail.
 */

/*
 * Phase 2H: seven nav items, one more than the six MASTER.md lists.
 *
 * MASTER.md "Shell" specifies 首页 / 发现 / 话题 / 系列 / 星系 / 指南, but 动态
 * (/moments, shipped in Phase 2D) is a real, guest-readable feed — dropping it
 * from the nav would leave it with no entry point at all. Rather than choose,
 * both are shown: the design system's six plus 动态. MASTER.md carries a note
 * recording this deliberate deviation.
 *
 * Icons: 指南 uses Map (a book/compass metaphor would collide with 系列's
 * BookOpen and 发现's Compass); 星系 uses Orbit.
 */
const NAV_ITEMS = [
  { label: "首页", to: "/", icon: Home },
  { label: "发现", to: "/discover", icon: Compass },
  { label: "话题", to: "/topics", icon: Hash },
  { label: "系列", to: "/series", icon: BookOpen },
  { label: "星系", to: "/galaxies", icon: Orbit },
  { label: "动态", to: "/moments", icon: MessageCircle },
  { label: "指南", to: "/guide", icon: Map },
];

function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

/**
 * Global search. Submits through the router instead of the browser.
 *
 * `method="get"` is deliberately NOT kept as a no-JS fallback: this app has no
 * server-rendered shell to fall back to, so the attribute would only ever cause
 * the full page load it used to cause.
 */
function SearchForm({
  className,
  inputClassName,
  onSubmitted,
}: {
  className?: string;
  inputClassName?: string;
  onSubmitted?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q");
        const keyword = typeof value === "string" ? value.trim() : "";
        onSubmitted?.();
        navigate(keyword ? `/search?q=${encodeURIComponent(keyword)}` : "/search");
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        placeholder="搜索文章、话题、用户"
        aria-label="搜索"
        className={cn(
          "h-9 w-full rounded-lg border border-input/80 bg-surface-sunken/70 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent-line focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring",
          inputClassName,
        )}
      />
    </form>
  );
}

/** Compact unread badge shared by the notification and message entries. */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground ring-2 ring-card"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // A panel that survives navigation is a trap on a phone: the user taps a
  // destination, the page changes underneath, and the sheet is still covering it.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  /*
   * Unread notification badge.
   *
   * GET /api/v1/home already carries `unreadNotifications` (HomeService counts
   * unread rows for the session user and returns 0 for guests). That is the
   * cheap source: no extra endpoint, and it is the same number the home page
   * would render. It is read here rather than in each page so the shell shows it
   * on every route.
   *
   * A failure is swallowed on purpose — the badge is decoration, and a toast for
   * a background count would be noise. The count simply stays absent.
   */
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setUnread(0);
      return;
    }
    homeApi
      .getGuestHome()
      .then((home) => {
        if (active) setUnread(home.unreadNotifications ?? 0);
      })
      .catch(() => {
        if (active) setUnread(0);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  /*
   * Unread message badge (Phase 2I-3).
   *
   * There is NO "mailbox total" endpoint — the backend only counts unread per
   * conversation (`countUnread` in ConversationService, compared against
   * `last_read_sequence`). So the header total is the sum of `unreadCount`
   * across the session's conversations, via the same helper the mailbox uses.
   *
   * `GET /api/v1/messages` is a bare array (not a PageResult like
   * /messages/{id}/messages), which is why this goes through `toConversations`.
   *
   * Like the notification badge, a failure is swallowed: the badge is
   * decoration, and the count simply stays 0.
   */
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setUnreadMessages(0);
      return;
    }
    messagesApi
      .listConversations()
      .then((items) => {
        if (active) setUnreadMessages(countUnreadConversations(toConversations(items)));
      })
      .catch(() => {
        if (active) setUnreadMessages(0);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Realtime: a message arriving while the user is anywhere in the app changes
  // the header count, not just the mailbox. Refetch rather than patch — the
  // frame carries a message, not a conversation.
  const [messageRefreshToken, setMessageRefreshToken] = useState(0);

  /*
   * Live message -> floating toast.
   *
   * Three guards, each of which is a real case rather than a hypothetical:
   *
   *   - `senderId === self` : the socket broadcasts to every member of the
   *     conversation, INCLUDING the sender's other devices. Without this, sending
   *     a message on your phone pops a "new message" toast on your laptop. The
   *     client only learns its own user id from the socket's `connected` frame
   *     (MeView and ProfileView both omit it), so it is captured below.
   *   - already on that conversation : a toast would cover the very message it is
   *     announcing.
   *   - guests : never subscribed, but the handler is not re-created per session,
   *     so the check stays.
   *
   * `pathnameRef` rather than `location.pathname` in the deps: the socket handler
   * is read through a ref by the hook, and re-subscribing the socket on every
   * navigation would drop the connection.
   */
  const { push } = useNotificationToasts();
  const selfUserIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useCommunityChatSocket(isAuthenticated, {
    onConnected: (userId) => {
      selfUserIdRef.current = userId;
    },
    onMessage: (conversationId, message) => {
      setMessageRefreshToken((token) => token + 1);

      if (!isAuthenticated) return;
      if (message?.senderId && message.senderId === selfUserIdRef.current) return;
      if (pathnameRef.current === `/messages/${conversationId}`) return;

      push({
        category: "MESSAGE",
        title: "收到一条新私信",
        body: message?.recalledAt ? "［消息已撤回］" : message?.body,
        href: `/messages/${conversationId}`,
      });
    },
  });

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || messageRefreshToken === 0) return;
    messagesApi
      .listConversations()
      .then((items) => {
        if (active) setUnreadMessages(countUnreadConversations(toConversations(items)));
      })
      .catch(() => {
        /* keep the previous count */
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, messageRefreshToken]);

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* First tab stop on every route — the header is ~10 stops long. */}
      <a
        href="#main"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        跳到主要内容
      </a>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 backdrop-blur-xl">
        <div className="content-shell flex items-center gap-2 py-2.5 md:gap-3">
          {/* Brand. The gold dot is the only brand mark in the header — it gives
              the wordmark something to sit against without adding a second logo. */}
          <Link
            to="/"
            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-md pr-1 text-[19px] font-bold tracking-tight text-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            星语
          </Link>

          {/*
           * `lg`, not `md`. 2026-10-03.
           *
           * Logo + this seven-item nav + the action cluster need 813px. The switch
           * used to happen at `md` (768px), so from 768 to 812 the desktop nav
           * appeared while there was still no room for it and every page scrolled
           * sideways — 45px at 768, which is exactly iPad portrait. 85 of the 91
           * routes were affected.
           *
           * `lg` is not a guess: the header search box in this same file already
           * switches at `lg:block`, so this is the breakpoint header content
           * already uses. Between 768 and 1023 the hamburger + sheet take over,
           * which is the same navigation a phone gets.
           */}
          <nav aria-label="主导航" className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <SearchForm className="mx-auto hidden max-w-sm flex-1 lg:block" />

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <Link
              to="/studio"
              className="focus-ring hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:inline-flex"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              创作
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-0.5 md:gap-1">
                {/* Phase 2I-2: real notification entry with a live unread badge.
                    The badge is capped at 99+ so a hot account cannot stretch the
                    header; the number itself is never hidden from screen readers.
                    The link stays ICON-ONLY with an aria-label — a visible text
                    label would change `link.textContent`, which the shell test
                    pins as empty when nothing is unread. */}
                <Link
                  to="/notifications"
                  aria-label={unread > 0 ? `通知（${unread} 条未读）` : "通知"}
                  className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
                >
                  <Bell className="h-[18px] w-[18px]" aria-hidden />
                  <UnreadBadge count={unread} />
                </Link>

                {/* Phase 2I-3: the message centre, same badge treatment as the
                    bell. Mail (not MessageCircle) because 动态 in the nav already
                    owns MessageCircle. */}
                <Link
                  to="/messages"
                  aria-label={unreadMessages > 0 ? `私信（${unreadMessages} 条未读）` : "私信"}
                  className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
                >
                  <Mail className="h-[18px] w-[18px]" aria-hidden />
                  <UnreadBadge count={unreadMessages} />
                </Link>

                {/* The user entry is a MENU, not a row of links — the prototype's 用户菜单.
                    Every destination it holds lives in UserMenu, which is their ONLY entry
                    point; read the note there before removing anything. */}
                <UserMenu username={user?.username ?? "我的主页"} onLogout={() => void logout()} />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* 登录 stays visible on phones: burying it behind the nav
                    disclosure costs a tap on the one action a guest most often
                    wants, and the row still fits at 390px. */}
                <Link
                  to="/login"
                  className="focus-ring rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-surface-sunken sm:px-3"
                >
                  登录
                </Link>
                {/* 注册 is the primary action for a guest; it used to be the
                    outlined one, which put the emphasis on the wrong control. */}
                <Link
                  to="/register"
                  className="focus-ring rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  注册
                </Link>
              </div>
            )}

            {/* Mobile disclosure. Rendered last so it sits at the trailing edge,
                and only under md — above that the real nav is visible. */}
            <button
              type="button"
              aria-expanded={navOpen}
              aria-controls="mobile-nav"
              aria-label={navOpen ? "关闭导航菜单" : "打开导航菜单"}
              onClick={() => setNavOpen((open) => !open)}
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-sunken lg:hidden"
            >
              {navOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {navOpen ? (
          <div
            id="mobile-nav"
            className="animate-sheet-in border-t border-border/70 bg-card lg:hidden"
          >
            <div className="content-shell space-y-3 py-4">
              {/* No autoFocus here on purpose: the panel exists so the reader can
                  reach a destination, and focusing the search field would pop the
                  on-screen keyboard over the very links they opened it for. */}
              <SearchForm onSubmitted={() => setNavOpen(false)} />

              <nav aria-label="移动端导航" className="grid grid-cols-2 gap-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(location.pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring flex h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-primary font-medium text-primary-foreground"
                          : "bg-surface-sunken/60 text-foreground hover:bg-surface-sunken",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="flex items-center gap-2 pt-1">
                <Link
                  to="/studio"
                  className="focus-ring inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-medium text-accent-foreground"
                >
                  <PenLine className="h-4 w-4" aria-hidden />
                  创作
                </Link>
                {!isAuthenticated ? (
                  <Link
                    to="/login"
                    className="focus-ring inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm text-foreground"
                  >
                    登录
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main" className="content-shell flex-1">
        {/* P1-1: the single Suspense boundary for every lazy route page.
            It sits INSIDE the shell so the header (nav, search, unread badges)
            and the footer stay mounted while a route chunk downloads — a
            root-level boundary would blank the whole app on first navigation. */}
        {/*
          Page-level boundary, INSIDE the shell.

          A page that throws loses only its own content — the header, the nav,
          the unread badges and the footer stay mounted and usable, so the reader
          can simply navigate somewhere else. Before this existed there was no
          boundary anywhere in the app and a render throw blanked the whole tree.

          `resetKey` is the current path: leaving a crashed page clears the
          error instead of carrying it to the next route.
        */}
        <PageErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageState kind="loading" />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>

      <footer className="border-t border-border/70">
        <div className="content-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground-soft">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            星语
          </span>
          <nav aria-label="站点信息" className="flex flex-wrap gap-x-4 gap-y-1.5">
            <Link to="/announcements" className="transition-colors hover:text-accent-strong">
              公告
            </Link>
            {/* Phase 2I-4: the events square is public and guest-readable, so its
                entry point belongs in the footer rather than the seven-item main
                nav (which MASTER.md fixes and 2H already stretched to include
                动态). Without this, /events would have no entry point at all. */}
            <Link to="/events" className="transition-colors hover:text-accent-strong">
              社区活动
            </Link>
            {/* Phase 2K-1: /creators is guest-readable too (every underlying call
                is public), so it shares the footer slot with /events rather than
                taking a main-nav item. */}
            <Link to="/creators" className="transition-colors hover:text-accent-strong">
              推荐作者
            </Link>
            <Link to="/guide" className="transition-colors hover:text-accent-strong">
              指南
            </Link>
            <Link to="/rules" className="transition-colors hover:text-accent-strong">
              社区规则
            </Link>
            {/* Phase 3F: 推荐反馈. Like the other contact-the-team surfaces it
                lives in the footer, not the main nav — it is an occasional
                action, and the route is behind RequireAuth anyway. */}
            <Link
              to="/feedback/recommendations"
              className="transition-colors hover:text-accent-strong"
            >
              推荐反馈
            </Link>
          </nav>
        </div>
      </footer>

      {/* The floating notification stack. Fixed-position, so DOM order does not
          affect where it renders — it sits last so the live region is the final
          thing in the tree, which is where assistive tech expects it. */}
      <NotificationToaster />
    </div>
  );
}
