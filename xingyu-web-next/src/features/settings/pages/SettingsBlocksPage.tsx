import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import type { BlockedUser } from "@/api/users/users.types";
import { loadBlockedUsers, unblockUser } from "@/features/blocks/blocked-users.store";
import { PageState } from "@/components/shared/PageState";
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
 */

type LoadState = "loading" | "error" | "ready";

function formatInstant(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
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
        <h2 id="settings-blocks-heading" className="text-base font-semibold text-primary">
          屏蔽管理
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          你屏蔽的用户。屏蔽会解除你们之间的关注关系，且双方无法互发私信。
        </p>
      </section>

      {actionError ? (
        <p role="alert" data-testid="blocks-action-error" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {users.length === 0 ? (
        <PageState kind="empty" title="还没有屏蔽任何用户" />
      ) : (
        <ul data-testid="blocks-list" className="flex flex-col gap-3">
          {users.map((user) => (
            <li
              key={user.userId || user.username}
              data-testid={`blocked-${user.username}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {user.displayName ?? user.username}
                </p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </div>

              <p className="text-xs text-muted-foreground">
                屏蔽于 <span data-testid={`blocked-at-${user.username}`}>{formatInstant(user.blockedAt)}</span>
              </p>

              <Button
                variant="outline"
                size="sm"
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
