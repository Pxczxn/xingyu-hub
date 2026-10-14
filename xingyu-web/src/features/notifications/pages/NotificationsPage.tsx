import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { ApiError } from "@/api/client";
import { notificationsApi } from "@/api/notifications/notifications.api";
import {
  countUnread,
  notificationHref,
  type Notification,
} from "@/api/notifications/notifications.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { NotificationRow } from "../NotificationRow";
import { notifyUnreadChanged } from "../unread-sync";

/*
 * Notification centre.
 *
 * 2026-10-06 (contract recovery) — three deliberate removals:
 *
 *  1. The 「全部 / 互动 / 系统」 filter tabs are GONE. The backend has exactly one
 *     real producer (`FOLLOW`), so those tabs offered a taxonomy over nothing:
 *     selecting 系统 could only ever produce an empty list, and 互动 advertised
 *     点赞/评论 that no code path writes. A filter is a promise about the data.
 *  2. The empty-state copy no longer says "点赞或评论也会出现在这里" for the same
 *     reason — it described producers that do not exist.
 *  3. The row's destination is now the structured `actor` (see notificationHref),
 *     not a per-category fallback. A follow notification opens the follower's
 *     canonical profile.
 *
 * `limit` is the only paging knob and the backend caps it at 100 with no cursor,
 * so one window is fetched. Pagination is tracked debt; nothing here claims the
 * list is "all notifications".
 *
 * Read-state discipline, deliberately different from Legacy:
 * Legacy optimistically flipped a row to read even when the PATCH failed. That
 * paints a state the server does not have. Here a failed mark-read leaves the
 * row unread and says so — and it publishes nothing to the header badge.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; items: Notification[] };

const LIMIT = 50;

/**
 * Reading column width for the list.
 *
 * The shell is 1200px wide, so at 1440 the rows used to run the full ~1104px and a
 * one-line FOLLOW notification ("小明 关注了你") was stretched across the whole page
 * with its timestamp marooned at the far right. 42rem keeps the sentence and its
 * time in one comfortable glance. Centred so the column reads as a deliberate
 * measure rather than a left-hugging fragment.
 */
const READING_COLUMN = "mx-auto w-full max-w-2xl";

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

/*
 * Date grouping for the timeline.
 *
 * Why group at all: a notification feed is read as "what happened recently", and
 * a flat list of fifty rows makes that question unanswerable — every row carries
 * its own timestamp, so the reader has to parse fifty timestamps to reconstruct
 * an order they already intuitively know. A day separator answers it once.
 *
 * Day boundaries are computed in Asia/Shanghai, the same zone
 * `formatNotificationAt` renders in. Computing them in the browser's local zone
 * would put a 23:30 CST notification and a 00:30 CST notification in the same
 * bucket for a reader in UTC, contradicting the timestamps printed right next to
 * them.
 */
const SHANGHAI = "Asia/Shanghai";

function shanghaiDayKey(value: string | null | undefined, offsetDays = 0): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - offsetDays * 86_400_000);
  return shifted.toLocaleDateString("zh-CN", { timeZone: SHANGHAI });
}

type NotificationGroup = { key: string; label: string; items: Notification[] };

/**
 * Split a notification list into day groups, preserving the server's
 * newest-first order both between groups and inside them.
 *
 * Rows with an unusable timestamp land in a trailing 「时间未知」 group rather
 * than being dropped or silently attached to today — the backend allows a null
 * `createdAt`, and losing a notification is worse than labelling it honestly.
 */
function groupByDay(items: Notification[]): NotificationGroup[] {
  const todayKey = shanghaiDayKey(null);
  const yesterdayKey = shanghaiDayKey(null, 1);
  const groups: NotificationGroup[] = [];
  const index = new Map<string, NotificationGroup>();

  for (const item of items) {
    const rawKey = shanghaiDayKey(item.createdAt);
    const key = rawKey || "unknown";
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        label:
          key === "unknown"
            ? "时间未知"
            : key === todayKey
              ? "今天"
              : key === yesterdayKey
                ? "昨天"
                : key,
        items: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /*
   * The unread number shown here is the SERVER's account-wide count, not a count
   * of this 50-row window.
   *
   * Why it matters: the header badge reads the same endpoint. If this page counted
   * its own window instead, an account with more unread than the window would show
   * two different numbers on the same screen — and 「全部已读」 acts account-wide, so
   * the page would be describing a scope it is not acting on.
   *
   * `null` means "not read yet / unreadable": the lede then falls back to the
   * window count so the page still says something true, and the badge is left
   * alone rather than being set to a guess.
   */
  const [serverUnread, setServerUnread] = useState<number | null>(null);

  /**
   * Re-read the account-wide count and publish it to the header.
   *
   * Only ever called AFTER the server accepted a write. If the read fails, nothing
   * is published — the header keeps its previous (server-derived) value instead of
   * silently drifting. This is the whole "a failed write must not move the badge"
   * guarantee, in one place.
   */
  const publishServerUnread = useCallback(async () => {
    try {
      const value = await notificationsApi.getUnreadCount();
      setServerUnread(value);
      notifyUnreadChanged(value);
    } catch {
      /* keep both surfaces on their previous server-derived value */
    }
  }, []);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setActionError(null);

    notificationsApi
      .list(LIMIT)
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err) });
      });

    void publishServerUnread();

    return () => {
      active = false;
    };
  }, [publishServerUnread, reloadKey]);

  function replaceItems(next: Notification[]) {
    setState((current) => (current.kind === "ready" ? { kind: "ready", items: next } : current));
  }

  /**
   * Clicking a row opens it: mark read first (best effort), then follow the
   * destination if there is one.
   *
   * A failed mark-read is reported but does NOT block navigation — the reader
   * asked to go somewhere, and refusing to move because a background state write
   * failed would be the wrong trade. What it must not do is *pretend* the write
   * succeeded.
   */
  async function onOpen(item: Notification) {
    if (pending[item.id]) return;
    setActionError(null);

    const href = notificationHref(item);

    if (!item.read) {
      setPending((map) => ({ ...map, [item.id]: true }));
      try {
        const updated = await notificationsApi.markRead(item.id);
        if (state.kind === "ready") {
          replaceItems(
            state.items.map((row) =>
              row.id === item.id ? { ...row, ...updated, read: true } : row,
            ),
          );
        }
        // Server confirmed the transition — now resync the account-wide count.
        // Not awaited: the reader is on their way to the profile, and an unmounted
        // page's setState is a no-op while the published event still reaches the
        // header (which stays mounted).
        void publishServerUnread();
      } catch (err: unknown) {
        setActionError(
          err instanceof ApiError && err.problem.status === 404
            ? "这条通知已不存在，可能已被删除。"
            : "标记已读失败，请稍后重试。",
        );
      } finally {
        setPending((map) => {
          const next = { ...map };
          delete next[item.id];
          return next;
        });
      }
    }

    if (href) navigate(href);
  }

  async function onMarkAllRead() {
    if (busy || state.kind !== "ready") return;
    setActionError(null);
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      // read-all answers 204 with no payload, so reflect it locally.
      replaceItems(state.items.map((row) => ({ ...row, read: true })));
      // The endpoint's semantics are ACCOUNT-WIDE, so 0 is not a guess: every
      // unread row for this user was just marked read. Publishing it is exactly
      // "page, header and database agree".
      setServerUnread(0);
      notifyUnreadChanged(0);
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.problem.detail : "全部标记已读失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        {/* RequireAuth already guaranteed a session, so a 401 here means it
            expired mid-visit — say that, not a generic "try again later". */}
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired ? "登录状态已过期，请重新登录。" : "无法读取通知列表，请稍后重试。"
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { items } = state;
  const unread = serverUnread ?? countUnread(items);

  return (
    <div className={`section-gap ${READING_COLUMN}`}>
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">通知中心</h1>
        <p className="lede mt-2">{unread > 0 ? `${unread} 条未读` : "没有未读通知"}</p>
      </header>

      {/* One bulk action, no filters. The filter strip that used to sit here offered
          全部/互动/系统 over a backend that only ever produces FOLLOW. */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || unread === 0}
          onClick={() => void onMarkAllRead()}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden />
          {busy ? "处理中…" : "全部已读"}
        </Button>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {items.length === 0 ? (
        /*
         * Deliberately light: no illustration, no card. An account with nothing in
         * it is the ordinary state of a new reader, and a big framed box with a
         * drawing in it made "nothing happened yet" look like an event. The copy
         * names the ONLY thing that can actually appear here.
         */
        <PageState
          kind="empty"
          illustration={false}
          className="border-0 bg-transparent py-10"
          title="暂无通知"
          description="有人关注你时，会出现在这里。"
        />
      ) : (
        /*
          Timeline, not a flat list.
          Each day is its own section with a labelled rule, so "when" is answered
          once per group instead of once per row. The groups are siblings — there
          is no nesting — so the page keeps a two-level outline: h1 (通知中心)
          then one h2 per day.
        */
        <div className="flex flex-col gap-7">
          {groupByDay(items).map((group) => (
            <section key={group.key} aria-labelledby={`notification-day-${group.key}`}>
              <div className="mb-3 flex items-center gap-3">
                <h2
                  id={`notification-day-${group.key}`}
                  className="text-meta font-medium text-foreground-soft"
                >
                  {group.label}
                </h2>
                <span aria-hidden className="h-px flex-1 bg-border/60" />
                <span className="text-meta tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </div>

              <ul className="flex list-none flex-col gap-2 p-0">
                {/*
                  07d: staggered by position WITHIN the day, and the stagger restarts at
                  each group — a day is its own visual unit, so its first row is the first
                  thing the eye lands on when that group scrolls into view.

                  Deliberately NO `key=` replay on this list. The rows re-render on every
                  mark-read, and replaying fifty of them because one was clicked is the
                  motion abuse this batch exists to avoid. `animate-rise-in` only fires on
                  mount, which is the one moment the content is genuinely new: the first
                  paint, or coming back to the page.
                */}
                {group.items.map((item, index) => (
                  <NotificationRow
                    key={item.id}
                    notification={item}
                    href={notificationHref(item)}
                    pending={Boolean(pending[item.id])}
                    index={index}
                    onOpen={(row) => void onOpen(row)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
