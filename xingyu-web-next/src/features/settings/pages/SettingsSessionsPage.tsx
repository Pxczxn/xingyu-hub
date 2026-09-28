import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { sessionsApi } from "@/api/settings/sessions.api";
import type { SessionSummary } from "@/api/settings/sessions.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * /settings/sessions — Login sessions (Phase 2A-1).
 *
 * Real contract (verified 2026-09-22):
 *   GET    /api/v1/me/sessions                 -> all rows incl. revoked
 *   DELETE /api/v1/me/sessions/{sessionId}     -> 204
 *   POST   /api/v1/me/sessions/revoke-others   -> 204 (keeps the caller's own)
 *
 * Safety rules enforced here:
 *   - `revoke` does NOT special-case the current session server-side (deleting
 *     your own id works and immediately 401s), so the current row never gets a
 *     revoke control.
 *   - Both destructive actions require an explicit inline confirmation; there is
 *     no window.confirm, which keeps them testable and keyboard-accessible.
 *   - Already-revoked rows are filtered out by the API layer.
 */

type LoadState = "loading" | "error" | "ready";

function formatInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function SettingsSessionsPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [confirmingOthers, setConfirmingOthers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setActionError(null);
    setPendingRevokeId(null);
    setConfirmingOthers(false);
    sessionsApi
      .list()
      .then((list) => {
        if (!active) return;
        setSessions(list);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const revoke = useCallback(async (sessionId: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await sessionsApi.revoke(sessionId);
      setPendingRevokeId(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.problem.detail : "退出会话失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const revokeOthers = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await sessionsApi.revokeOthers();
      setConfirmingOthers(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.problem.detail : "退出其它会话失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="登录会话加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const others = sessions.filter((session) => !session.current);

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-sessions-heading">
        <h2 id="settings-sessions-heading" className="text-base font-semibold text-primary">
          登录会话
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          这里列出当前账号仍有效的登录会话。
        </p>
      </section>

      {actionError ? (
        <p role="alert" data-testid="sessions-action-error" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <PageState kind="empty" title="暂无登录会话" />
      ) : (
        <ul data-testid="sessions-list" className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              data-testid={`session-${session.sessionId}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {session.deviceLabel}
                </span>
                {session.current ? (
                  <span
                    data-testid="session-current-badge"
                    className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                  >
                    当前会话
                  </span>
                ) : null}
              </div>

              <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:gap-6">
                <div className="flex gap-1">
                  <dt>最近活跃</dt>
                  <dd data-testid="session-last-active">{formatInstant(session.lastActiveAt)}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>过期时间</dt>
                  <dd data-testid="session-expires">{formatInstant(session.expiresAt)}</dd>
                </div>
              </dl>

              {/* The current session gets no revoke control on purpose: the backend
                  would accept it and immediately invalidate this very request. */}
              {!session.current ? (
                <div className="mt-3">
                  {pendingRevokeId === session.sessionId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">确认退出该会话？</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        data-testid={`session-revoke-confirm-${session.sessionId}`}
                        onClick={() => void revoke(session.sessionId)}
                      >
                        确认退出
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setPendingRevokeId(null)}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      data-testid={`session-revoke-${session.sessionId}`}
                      onClick={() => setPendingRevokeId(session.sessionId)}
                    >
                      退出该会话
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 ? (
        <div className="border-t border-border pt-4">
          {confirmingOthers ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground">
                确认退出其它 {others.length} 个会话？当前会话会保留。
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                data-testid="sessions-revoke-others-confirm"
                onClick={() => void revokeOthers()}
              >
                确认退出
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmingOthers(false)}
              >
                取消
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              data-testid="sessions-revoke-others"
              disabled={busy}
              onClick={() => setConfirmingOthers(true)}
            >
              退出其它所有会话
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
