import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { ApiError } from "@/api/client";
import { notificationsApi } from "@/api/notifications/notifications.api";
import {
  countUnreadByBucket,
  notificationBucket,
  notificationCategoryLabel,
  notificationFallbackHref,
  type Notification,
  type NotificationTab,
} from "@/api/notifications/notifications.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { NotificationRow } from "../NotificationRow";

/*
 * Notification centre (Phase 2I-2).
 *
 * This is a NEW page, not a port. Legacy left `/notifications` as a redirect to
 * `/` and only ever rendered notifications inside a header popover, so there is
 * nothing to copy route-wise — but its icon/bucket/label mapping is reused
 * verbatim (see notifications.types.ts) because that part was sound.
 *
 * `limit` is the only paging knob and the backend caps it at 50 with no cursor,
 * so one window is fetched and the tabs filter client-side.
 *
 * Read-state discipline, deliberately different from Legacy:
 * Legacy optimistically flipped a row to read even when the PATCH failed. That
 * paints a state the server does not have. Here a failed mark-read leaves the
 * row unread and says so.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; items: Notification[] };

const LIMIT = 50;

const TABS: { id: NotificationTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "social", label: "互动" },
  { id: "system", label: "系统" },
];

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
  const [tab, setTab] = useState<NotificationTab>("all");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

    return () => {
      active = false;
    };
  }, []);

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

    const href = notificationFallbackHref(item.category);

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
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { items } = state;
  const counts = countUnreadByBucket(items);
  const visible =
    tab === "all" ? items : items.filter((item) => notificationBucket(item.category) === tab);

  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">通知中心</h1>
        <p className="lede mt-2">{counts.all > 0 ? `${counts.all} 条未读` : "没有未读通知"}</p>
      </header>

      {/* Segmented filter + the one bulk action, on the same line. The tabs are
          not a separate toolbar row because they are a property of the list
          directly beneath them. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="通知分类"
          className="flex items-center gap-1 rounded-lg bg-surface-sunken p-1"
        >
          {TABS.map((entry) => {
            const active = entry.id === tab;
            const unread = counts[entry.id];
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setTab(entry.id)}
                className={
                  active
                    ? "rounded-md bg-card px-3 py-1.5 text-meta font-medium text-primary"
                    : "rounded-md px-3 py-1.5 text-meta text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {entry.label}
                {unread > 0 ? (
                  <span className="ml-1 tabular-nums text-accent-strong">{unread}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <Button
          variant="outline"
          size="sm"
          disabled={busy || counts.all === 0}
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

      {visible.length === 0 ? (
        <PageState
          kind="empty"
          title={items.length === 0 ? "暂无通知" : "这个分类下没有通知"}
          description={
            items.length === 0
              ? "有人关注你、点赞或评论时，会出现在这里。"
              : "切回「全部」查看其它通知。"
          }
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
          {groupByDay(visible).map((group) => (
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
                {group.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    notification={item}
                    label={notificationCategoryLabel(item.category)}
                    href={notificationFallbackHref(item.category)}
                    pending={Boolean(pending[item.id])}
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
