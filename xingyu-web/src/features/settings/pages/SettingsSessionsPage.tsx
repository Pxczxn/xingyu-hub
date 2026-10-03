import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { sessionsApi } from "@/api/settings/sessions.api";
import type { SessionSummary } from "@/api/settings/sessions.types";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * This page was a stack of `ul > li` cards, one per session — the same shape as
 * /settings/blocks and every other list in the settings area. But a session row
 * is not a "thing you read"; it is a RECORD with three comparable fields
 * (device, last active, expires) and one action. Comparable fields belong in
 * aligned columns, so a reader can scan down "last active" and spot the stale
 * ones. It is now a real table.
 *
 * The current session is pinned to the top and tinted, because "which one am I
 * on" is the question that brings people to this page — and it is the one row
 * that cannot be revoked.
 * ---------------------------------------------------------------------------
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
        // Current session first: it is the row the reader is looking for, and the
        // only one that cannot be acted on.
        setSessions([...list].sort((a, b) => Number(b.current) - Number(a.current)));
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
        <div className="flex items-baseline gap-2.5">
          <h2 id="settings-sessions-heading" className="section-heading">
            登录会话
          </h2>
          <span className="text-meta tabular-nums text-muted-foreground">{sessions.length}</span>
        </div>
        <p className="lede mt-1.5 max-w-2xl">
          当前账号仍有效的登录会话。发现不认识的设备时，退出该会话并修改密码。
        </p>
      </section>

      {actionError ? (
        <p
          role="alert"
          data-testid="sessions-action-error"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <PageState kind="empty" title="暂无登录会话" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          {/*
            Responsive table, ONE DOM tree.
            A `<table>` cannot reflow, so on a 390px viewport the 操作 column was
            clipped off the right edge and the revoke buttons became unreachable.
            Rather than render a second (card) layout below `md` — which would
            duplicate every `data-testid` and break the session tests — the rows
            become flex columns and each cell prints its own inline label via a
            `md:hidden` span. Above `md` everything reverts to a real table.
          */}
          <Table data-testid="sessions-list">
            <TableHeader className="hidden md:table-header-group">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%]">设备</TableHead>
                <TableHead>最近活跃</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.sessionId}
                  data-testid={`session-${session.sessionId}`}
                  className={cn(
                    "flex flex-col gap-1.5 p-4 md:table-row md:p-0",
                    session.current && "bg-accent-soft/60 hover:bg-accent-soft/60",
                  )}
                >
                  <TableCell className="flex flex-wrap items-center gap-2 p-0 md:table-cell md:p-3">
                    <span className="font-medium text-primary">{session.deviceLabel}</span>
                    {session.current ? (
                      <Badge data-testid="session-current-badge">当前会话</Badge>
                    ) : null}
                  </TableCell>

                  <TableCell
                    data-testid="session-last-active"
                    className="flex items-baseline gap-2 p-0 text-meta text-muted-foreground md:table-cell md:p-3 md:text-sm"
                  >
                    <span className="shrink-0 text-muted-foreground/70 md:hidden">最近活跃</span>
                    <span className="tabular-nums">{formatInstant(session.lastActiveAt)}</span>
                  </TableCell>

                  <TableCell
                    data-testid="session-expires"
                    className="flex items-baseline gap-2 p-0 text-meta text-muted-foreground md:table-cell md:p-3 md:text-sm"
                  >
                    <span className="shrink-0 text-muted-foreground/70 md:hidden">过期时间</span>
                    <span className="tabular-nums">{formatInstant(session.expiresAt)}</span>
                  </TableCell>

                  <TableCell className="p-0 pt-1.5 md:table-cell md:p-3 md:text-right">
                    {/* The current session gets no revoke control on purpose: the
                        backend would accept it and immediately invalidate this
                        very request. */}
                    {!session.current ? (
                      pendingRevokeId === session.sessionId ? (
                        <span className="flex flex-wrap items-center gap-2 md:justify-end">
                          <span className="text-meta text-foreground">确认退出该会话？</span>
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
                        </span>
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
                      )
                    ) : (
                      // Deliberately NOT the text "当前设备" — that string is the
                      // fixture's device label, and repeating it here would make
                      // `findByText("当前设备")` ambiguous.
                      <span className="hidden text-meta text-muted-foreground/60 md:inline">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {others.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-surface-sunken/40 px-4 py-3">
              {confirmingOthers ? (
                <>
                  <span className="text-meta text-foreground">
                    确认退出其它 {others.length} 个会话？当前会话会保留。
                  </span>
                  <span className="flex items-center gap-2">
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
                  </span>
                </>
              ) : (
                <>
                  <span className="text-meta text-muted-foreground">
                    还有 {others.length} 个其它设备处于登录状态。
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="sessions-revoke-others"
                    disabled={busy}
                    onClick={() => setConfirmingOthers(true)}
                  >
                    退出其它所有会话
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
