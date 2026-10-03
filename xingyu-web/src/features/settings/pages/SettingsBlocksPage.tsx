import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import type { BlockedUser } from "@/api/users/users.types";
import { loadBlockedUsers, unblockUser } from "@/features/blocks/blocked-users.store";
import { PageState } from "@/components/shared/PageState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/*
 * /settings/blocks — blocked users (Phase 2A-2a).
 *
 * Real contract (verified live 2026-09-23):
 *   GET    /api/v1/me/blocks              -> BlockedUser[] (bare array, limit only)
 *   DELETE /api/v1/me/blocks/{username}   -> 204 (idempotent)
 *
 * The list is read through the shared store so the profile page and this page
 * share one fetch (block state has no dedicated endpoint — see the store).
 *
 * Unblocking does NOT need a confirmation: it is not destructive (the backend
 * does not restore the follows that blocking removed), and it is trivially
 * repeatable. Blocking, which is destructive, is confirmed on the profile page.
 *
 * A failure keeps the row listed (the state the backend still reports) and
 * surfaces the reason — the UI never drops into a fake success.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * Same `ul > li` card shape as /settings/sessions had, which is why the two were
 * indistinguishable. They now differ by what the reader is doing:
 *
 *   sessions -> a RECORD with comparable fields -> table, aligned columns
 *   blocks   -> a LIST OF PEOPLE                -> avatar rows, no table head
 *
 * People are recognised by face and name, not by scanning a column, so the
 * avatar leads and the three data points collapse into two lines. There is no
 * table header because there are only three columns' worth of content and a
 * header row would add more ink than the data it labels.
 * ---------------------------------------------------------------------------
 */

type LoadState = "loading" | "error" | "ready";

function formatInstant(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function initialOf(user: BlockedUser): string {
  return (user.displayName || user.username || "?").slice(0, 1).toUpperCase();
}

export function SettingsBlocksPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Handler-level duplicate-click guard (not only `disabled`), so a second
  // synchronous invocation cannot fire a second request.
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setActionError(null);
    setPendingUsername(null);
    loadBlockedUsers({ force: true })
      .then((list) => {
        if (!active) return;
        setUsers(list);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const unblock = useCallback(async (username: string) => {
    if (pendingRef.current) return; // duplicate-click guard
    pendingRef.current = true;
    setPendingUsername(username);
    setActionError(null);
    try {
      await unblockUser(username);
      setReloadKey((key) => key + 1);
    } catch (error) {
      // Keep the row listed — that is still the state the backend reports.
      setActionError(
        error instanceof ApiError ? error.problem.detail : "解除屏蔽失败，请稍后重试。",
      );
    } finally {
      pendingRef.current = false;
      setPendingUsername(null);
    }
  }, []);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="屏蔽列表加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-blocks-heading">
        <div className="flex items-baseline gap-2.5">
          <h2 id="settings-blocks-heading" className="section-heading">
            屏蔽管理
          </h2>
          <span className="text-meta tabular-nums text-muted-foreground">{users.length}</span>
        </div>
        <p className="lede mt-1.5 max-w-2xl">
          你屏蔽的用户。屏蔽会解除你们之间的关注关系，且双方无法互发私信。
        </p>
      </section>

      {actionError ? (
        <p
          role="alert"
          data-testid="blocks-action-error"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {users.length === 0 ? (
        <PageState kind="empty" title="还没有屏蔽任何用户" />
      ) : (
        <ul data-testid="blocks-list" className="flex list-none flex-col gap-2 p-0">
          {users.map((user) => (
            <li
              key={user.userId || user.username}
              data-testid={`blocked-${user.username}`}
              className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-3.5"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-surface-sunken text-meta font-medium text-foreground-soft">
                  {initialOf(user)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-medium text-primary">
                  {user.displayName ?? user.username}
                </p>
                <p className="truncate text-meta text-muted-foreground">@{user.username}</p>
              </div>

              <p className="hidden shrink-0 text-meta text-muted-foreground sm:block">
                屏蔽于{" "}
                <span
                  data-testid={`blocked-at-${user.username}`}
                  className="tabular-nums text-foreground-soft"
                >
                  {formatInstant(user.blockedAt)}
                </span>
              </p>

              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={pendingUsername !== null}
                data-testid={`unblock-${user.username}`}
                onClick={() => void unblock(user.username)}
              >
                {pendingUsername === user.username ? "处理中" : "解除屏蔽"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
