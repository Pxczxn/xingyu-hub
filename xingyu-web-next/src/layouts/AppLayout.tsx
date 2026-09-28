import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Bell, BookOpen, Compass, Hash, Home, LogOut, Mail, Map, MessageCircle, Orbit, PenLine, User as UserIcon } from "lucide-react";
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
 * The message centre (私信) is still not built (Phase 2I-3), so there is
 * deliberately no message icon: an icon that leads nowhere is worse than no
 * icon. Add it when the inbox lands.
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

export function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();

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

  useCommunityChatSocket(isAuthenticated, {
    onMessage: () => setMessageRefreshToken((token) => token + 1),
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
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="content-shell flex items-center gap-4 py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            星语
          </Link>

          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action="/search" method="get" className="mx-auto hidden max-w-sm flex-1 lg:block">
            <input
              type="search"
              name="q"
              placeholder="搜索文章、话题、用户"
              aria-label="搜索"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/studio"
              className="hidden items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 sm:inline-flex"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              创作
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {/* Phase 2I-2: real notification entry with a live unread badge.
                    The badge is capped at 99+ so a hot account cannot stretch the
                    header; the number itself is never hidden from screen readers. */}
                <Link
                  to="/notifications"
                  aria-label={unread > 0 ? `通知（${unread} 条未读）` : "通知"}
                  className="relative flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                  {unread > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </Link>

                {/* Phase 2I-3: the message centre, same badge treatment as the
                    bell. Mail (not MessageCircle) because 动态 in the nav already
                    owns MessageCircle. */}
                <Link
                  to="/messages"
                  aria-label={unreadMessages > 0 ? `私信（${unreadMessages} 条未读）` : "私信"}
                  className="relative flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  {unreadMessages > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground"
                    >
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  ) : null}
                </Link>

                {/* /api/v1/me does not expose a username, so link to /me, which
                    resolves the real username via /api/v1/me/profile. Never hardcode. */}
                <Link
                  to="/me"
                  className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" aria-hidden />
                  {user?.username ?? "我的主页"}
                </Link>
                <Link to="/me/collections" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  收藏夹
                </Link>
                <Link to="/me/bookshelf" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  书架
                </Link>
                {/* Phase 2I-1: the follow graph. Kept next to the other /me
                    shortcuts; both are RequireAuth, so they only appear here
                    (this whole block is the signed-in branch). */}
                <Link to="/me/following" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  关注
                </Link>
                {/* Phase 2I-5: the owner's own moment history. Signed-in only,
                    like the other /me shortcuts — the public feed is in the
                    main nav as 动态. */}
                <Link to="/me/moments" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  我的动态
                </Link>
                {/* Phase 2J-1: the rest of 我的互动. Same slot and same reason as
                    我的动态 — these are session-scoped trails, so they belong in
                    the signed-in branch. `/me/history` is intentionally missing:
                    the backend has no such route. */}
                <Link to="/me/likes" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  我的喜欢
                </Link>
                <Link to="/me/comments" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  我的评论
                </Link>
                {/* Phase 3A: 徽章成就. Session-scoped like the rest of this
                    branch — `/me/badges` needs a session and has no public
                    counterpart (badges are never shown on someone else's
                    profile). */}
                <Link to="/me/badges" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  徽章
                </Link>
                {/* Phase 3B: 成长记录. The aggregate view (data + badges + reading
                    + comments); `/me/badges` remains the badge-only page. */}
                <Link to="/me/growth" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  成长
                </Link>
                {/* Phase 3C: 关系请求. Only group join requests can appear here
                    (following is open, so no follow request exists). Session-scoped. */}
                <Link to="/me/requests" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  关系请求
                </Link>
                {/* Phase 3D: 我的探索. Personal exploration preferences (official
                    domains + personal labels). Session-scoped. */}
                <Link to="/me/interests" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  我的探索
                </Link>
                {/* Phase 3E: 我的群聊. Group-only view of the mailbox + creation. */}
                <Link to="/me/groups" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  我的群聊
                </Link>
                {/* Phase 2J-2: 举报与申诉. Session-scoped like the rest of this
                    branch. The public 社区规则 link stays in the footer next to
                    the other informational links. */}
                <Link to="/reports" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  举报与申诉
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-md px-3 py-2 text-sm text-primary hover:bg-muted">
                  登录
                </Link>
                <Link
                  to="/register"
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="content-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-xs text-muted-foreground">
          <span>星语</span>
          <nav aria-label="站点信息" className="flex flex-wrap gap-x-4">
            <Link to="/announcements" className="hover:text-foreground hover:underline">
              公告
            </Link>
            {/* Phase 2I-4: the events square is public and guest-readable, so its
                entry point belongs in the footer rather than the seven-item main
                nav (which MASTER.md fixes and 2H already stretched to include
                动态). Without this, /events would have no entry point at all. */}
            <Link to="/events" className="hover:text-foreground hover:underline">
              社区活动
            </Link>
            {/* Phase 2K-1: /creators is guest-readable too (every underlying call
                is public), so it shares the footer slot with /events rather than
                taking a main-nav item. */}
            <Link to="/creators" className="hover:text-foreground hover:underline">
              推荐作者
            </Link>
            <Link to="/guide" className="hover:text-foreground hover:underline">
              指南
            </Link>
            <Link to="/rules" className="hover:text-foreground hover:underline">
              社区规则
            </Link>
            {/* Phase 3F: 推荐反馈. Like the other contact-the-team surfaces it
                lives in the footer, not the main nav — it is an occasional
                action, and the route is behind RequireAuth anyway. */}
            <Link to="/feedback/recommendations" className="hover:text-foreground hover:underline">
              推荐反馈
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
