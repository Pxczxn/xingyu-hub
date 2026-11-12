import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { ApiError } from "@/api/client";
import { notificationsApi } from "@/api/notifications/notifications.api";
import {
  notificationHref,
  type Notification,
} from "@/api/notifications/notifications.types";
import { HeaderMenu } from "@/components/shared/HeaderMenu";
import { NotificationRow } from "./NotificationRow";
import { notifyUnreadChanged } from "./unread-sync";

/*
 * Bell popover. Same header card as the mailbox menu: it hangs under the
 * icon and sizes itself to the viewport. No category filter — the only
 * producer today is FOLLOW. The full /notifications page stays.
 */

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: Notification[] };

export function NotificationBell({ unread }: { unread: number | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setState({ kind: "loading" });
    setActionError(null);
    try {
      const items = await notificationsApi.list(50);
      setState({ kind: "ready", items });
    } catch {
      setState({ kind: "error" });
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function onOpen(item: Notification) {
    if (pending[item.id]) return;
    setActionError(null);
    const href = notificationHref(item);

    if (!item.read) {
      setPending((map) => ({ ...map, [item.id]: true }));
      try {
        const updated = await notificationsApi.markRead(item.id);
        setState((current) =>
          current.kind === "ready"
            ? {
                kind: "ready",
                items: current.items.map((row) =>
                  row.id === item.id ? { ...row, ...updated, read: true } : row,
                ),
              }
            : current,
        );
        const count = await notificationsApi.getUnreadCount();
        notifyUnreadChanged(count);
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

    if (href) {
      setOpen(false);
      navigate(href);
    }
  }

  async function onMarkAllRead() {
    if (busy || state.kind !== "ready") return;
    const unreadRows = state.items.some((item) => !item.read);
    if (!unreadRows && (unread ?? 0) <= 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await notificationsApi.markAllRead();
      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", items: current.items.map((row) => ({ ...row, read: true })) }
          : current,
      );
      notifyUnreadChanged(0);
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError && err.problem.detail
          ? err.problem.detail
          : "全部标记已读失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  const label = unread != null && unread > 0 ? `通知（${unread} 条未读）` : "通知";
  const canMarkAll = state.kind === "ready" && (state.items.some((item) => !item.read) || (unread ?? 0) > 0);

  return (
    <HeaderMenu
      label={label}
      count={unread ?? 0}
      icon={<Bell className="h-[18px] w-[18px]" aria-hidden />}
      title="通知"
      open={open}
      onOpenChange={onOpenChange}
      headerAction={
        <button
          type="button"
          className="focus-ring rounded-sm text-meta text-muted-foreground hover:text-foreground disabled:opacity-40"
          disabled={!canMarkAll || busy}
          onClick={() => void onMarkAllRead()}
        >
          {busy ? "处理中…" : "全部已读"}
        </button>
      }
    >
      {state.kind === "loading" || state.kind === "idle" ? (
        <p className="px-4 py-8 text-center text-meta text-muted-foreground">加载中…</p>
      ) : null}
      {state.kind === "error" ? (
        <div className="px-4 py-8 text-center">
          <p className="text-meta text-muted-foreground">无法读取通知，请稍后重试。</p>
          <button
            type="button"
            className="focus-ring mt-2 text-meta text-accent-strong hover:underline"
            onClick={() => void load()}
          >
            重新加载
          </button>
        </div>
      ) : null}
      {state.kind === "ready" && state.items.length === 0 ? (
        <p className="px-4 py-8 text-center text-meta text-muted-foreground">暂无通知</p>
      ) : null}
      {state.kind === "ready" && state.items.length > 0 ? (
        <ul className="divide-y divide-border">
          {state.items.map((item, index) => (
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
      ) : null}
      {actionError ? (
        <p role="alert" className="px-4 py-2 text-meta text-destructive">
          {actionError}
        </p>
      ) : null}
    </HeaderMenu>
  );
}
