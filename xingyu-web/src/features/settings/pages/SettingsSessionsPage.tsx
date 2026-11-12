import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { sessionsApi } from "@/api/settings/sessions.api";
import type { SessionSummary } from "@/api/settings/sessions.types";
import { PageState } from "@/components/shared/PageState";
import { ArchetypeFrame } from "@/components/layout";
import { PageSection } from "@/components/shared/PageSection";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
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
 *
 * --- 2026-11-10 批次 C：SK3 · 壳 / 紧 / 齐 -------------------------------
 * 「表」改成「紧」，理由是可判定的：映射表把本域的两页「表」给了 API Token 与
 * 邮箱（那两页的列真的能跨行比较：前缀/状态/创建时间、地址/验证状态）。
 * 会话只剩三个短字段 + 一个动作，值得用的是「一行一条、逐行读」，于是：
 *
 *   紧  一张容器内的发丝线行（`divide-y`），每行自带字段名（最近活跃 / 过期），
 *       没有表头带、没有逐项卡面；窄屏不再需要第二套布局 —— 原来那个
 *       "`md:` 之前把 `<td>` 变 flex + 用 `md:hidden` 补标签"的双形态 hack 随之删除。
 * 齐  无侧栏（frame 不传 `rail`）。表头带去掉后，本页与 /settings/blocks 的差别
 *     落在"行内有没有头像/两段身份信息"，与 /settings/api-tokens 的差别落在"有没有
 *     表头与对齐列"。
 * 壳  h1「设置」仍由 `SettingsLayout` 出，本页只出 h2「登录会话」。
 * 会话排序、单会话退出确认、退出其它会话、错误分支一行未动。
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

  if (loadState === "loading") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="compact">
        <PageState kind="loading" />
      </ArchetypeFrame>
    );
  }
  if (loadState === "error") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="compact">
        <PageState kind="error" title="登录会话加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </ArchetypeFrame>
    );
  }

  const others = sessions.filter((session) => !session.current);

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="compact">
      <PageSection
        id="settings-sessions-heading"
        title="登录会话"
        count={sessions.length}
        description="当前账号仍有效的登录会话。探索到不认识的设备时，退出该会话并修改密码。"
      >
        {actionError ? (
          <p
            role="alert"
            data-testid="sessions-action-error"
            className="mb-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
          >
            {actionError}
          </p>
        ) : null}

        {sessions.length === 0 ? (
          <PageState kind="empty" title="暂无登录会话" />
        ) : (
          <div className="overflow-hidden rounded-card border border-border/70 bg-card">
            {/*
              D=紧：一条会话是一行发丝线，不是一张卡，也不是一张带表头的表 ——
              表留给 /settings/api-tokens 那种"列可以跨行比较"的数据。这里只有
              三个短字段加一个动作，行内自带字段名（`最近活跃` / `过期`），
              所以窄屏不需要第二套布局，也不再需要 `md:` 之前的表格降级 hack。
              当前会话排在最前并染底色（它不能退出，是最容易被找的那一行）。
            */}
            <ul
              data-testid="sessions-list"
              className="list-none divide-y divide-border/60 p-0"
            >
              {sessions.map((session) => (
                <li
                  key={session.sessionId}
                  data-testid={`session-${session.sessionId}`}
                  className={cn(
                    "flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3",
                    session.current && "bg-accent-soft/40",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium text-primary">{session.deviceLabel}</span>
                    {session.current ? (
                      <Badge data-testid="session-current-badge">当前会话</Badge>
                    ) : null}
                  </span>

                  <p
                    data-testid="session-last-active"
                    className="flex items-baseline gap-1.5 text-meta"
                  >
                    <span className="text-caption text-muted-foreground">最近活跃</span>
                    <span className="tabular-nums text-foreground-soft">
                      {formatInstant(session.lastActiveAt)}
                    </span>
                  </p>

                  <p data-testid="session-expires" className="flex items-baseline gap-1.5 text-meta">
                    <span className="text-caption text-muted-foreground">过期</span>
                    <span className="tabular-nums text-foreground-soft">
                      {formatInstant(session.expiresAt)}
                    </span>
                  </p>

                  <span className="shrink-0">
                    {/* The current session gets no revoke control on purpose: the
                        backend would accept it and immediately invalidate this
                        very request. */}
                    {!session.current ? (
                      pendingRevokeId === session.sessionId ? (
                        <span className="flex flex-wrap items-center gap-2">
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
                      <span className="text-meta text-muted-foreground">—</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

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
      </PageSection>
    </ArchetypeFrame>
  );
}
