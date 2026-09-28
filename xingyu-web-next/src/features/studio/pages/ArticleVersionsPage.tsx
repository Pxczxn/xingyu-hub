import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleRevision, ArticleLifecycleStatus } from "@/api/articles/articles.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  REVISION_DISPLAY_LIMIT,
  canRestore,
  formatFrozenAt,
  restoreBlockedReason,
  revisionLabel,
  revisionTitle,
  visibilityLabel,
} from "../revision-history";

/*
 * /studio/content/:articleId/versions — 历史版本 (Phase 2L)
 *
 * ⚠️ THE LABELS HERE DELIBERATELY DIFFER FROM LEGACY.
 *
 * Legacy titled this page 「草稿恢复点」 and labelled every row 「自动保存」, with a
 * footer claiming 「自动保存每 3 分钟生成一次草稿版本」. That is false: the backend
 * endpoint reads FORMAL revisions, which are written on PUBLISH. A draft that
 * was merely saved has an empty history. Presenting them as auto-saves would
 * promise the user a safety net that does not exist, which is exactly the kind
 * of "nice-looking lie" this migration is supposed to remove.
 *
 * Legacy also rendered a "版本预览" pane that showed `draft.body` — the CURRENT
 * draft body — while the heading above it was the SELECTED version's title. So
 * the preview was the live draft regardless of which revision you clicked.
 * We show only what the revision actually froze (title / summary / visibility /
 * timestamp) and do not pretend to preview a body the endpoint does not expose.
 * `ArticleRevisionView` carries no body field at all — verify before adding one.
 */

type State =
  | { kind: "loading" }
  | { kind: "error" }
  /** 404 from the revisions endpoint — missing, or not ours. Indistinguishable. */
  | { kind: "unavailable" }
  | { kind: "ready"; revisions: ArticleRevision[]; status: ArticleLifecycleStatus | null };

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail?.trim() || fallback;
  }
  return fallback;
}

export function ArticleVersionsPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const pendingRef = useRef(false);

  const load = useCallback(async (signal: { active: boolean }) => {
    if (!articleId) {
      setState({ kind: "unavailable" });
      return;
    }
    try {
      // The owner list is the ONLY contract source for editorial status (the
      // draft DTO does not carry it). A failure here must not break the page —
      // status only decides whether we OFFER restore, so fall back to null and
      // let canRestore() treat it as unknown.
      const [revisions, status] = await Promise.all([
        articlesApi.listRevisions(articleId),
        articlesApi.getMyArticleStatus(articleId).catch(() => null),
      ]);
      if (!signal.active) return;
      setState({ kind: "ready", revisions, status });
      setSelectedId(revisions[0]?.id ?? null);
    } catch (error) {
      if (!signal.active) return;
      const code = error instanceof ApiError ? error.problem.status : 0;
      setState(code === 404 ? { kind: "unavailable" } : { kind: "error" });
    }
  }, [articleId]);

  useEffect(() => {
    const signal = { active: true };
    void load(signal);
    return () => {
      signal.active = false;
    };
  }, [load]);

  async function onRestore() {
    if (!articleId || !selectedId || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setActionError(null);
    try {
      await articlesApi.restoreRevision(articleId, selectedId);
      setRestored(true);
      setConfirming(false);
    } catch (error) {
      setConfirming(false);
      const status = error instanceof ApiError ? error.problem.status : 0;
      if (status === 404) {
        setActionError("该版本或文章已不存在，请刷新页面后重试。");
      } else if (status === 409) {
        // canEditDraft() refused: in review, frozen, or hidden.
        setActionError(describeError(error, "这篇稿件当前不可恢复版本。"));
      } else {
        setActionError(describeError(error, "恢复版本失败，请稍后重试。"));
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <PageState
        kind="error"
        title="加载版本历史失败"
        description="无法读取这篇文章的历史版本，请稍后重试。"
      />
    );
  }
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="文章不存在或无权查看" />;
  }

  const { revisions, status } = state;
  const displayed = revisions.slice(0, REVISION_DISPLAY_LIMIT);
  const selected = displayed.find((r) => r.id === selectedId) ?? displayed[0] ?? null;
  const restorable = canRestore(status);
  const blockedReason = restoreBlockedReason(status);

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio/submissions" className="hover:text-foreground">
          我的投稿
        </Link>
        <span aria-hidden="true"> / </span>
        <span>历史版本</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">历史版本</h1>
        <p className="text-sm text-muted-foreground">
          查看这篇文章每次发布时定格的版本，并可将其中一个恢复为当前草稿。
        </p>
      </header>

      {actionError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {restored ? (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
          已恢复为当前草稿。
          <Link to={`/studio/content/${encodeURIComponent(articleId ?? "")}`} className="ml-1 text-accent hover:underline">
            返回编辑器
          </Link>
        </p>
      ) : null}

      {revisions.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无可恢复的版本"
          // Explains WHY, so an empty page does not read as a loading failure.
          description="历史版本在文章发布时生成。这篇文章还没有发布过，所以还没有可恢复的版本。"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardContent className="p-0">
              <ul aria-label="版本列表" className="divide-y divide-border">
                {displayed.map((revision) => {
                  const active = selected?.id === revision.id;
                  return (
                    <li key={revision.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(revision.id)}
                        aria-pressed={active}
                        className={
                          "w-full px-4 py-3 text-left transition-colors " +
                          (active ? "bg-accent/10" : "hover:bg-muted/40")
                        }
                      >
                        <span className="text-xs text-muted-foreground">
                          {revisionLabel(revision)}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-foreground">
                          {revisionTitle(revision)}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatFrozenAt(revision.frozenAt) ?? "时间未提供"}
                          {" · "}
                          {visibilityLabel(revision.visibility)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              {selected ? (
                <>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-foreground">
                      {revisionTitle(selected)}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {revisionLabel(selected)}
                      {" · "}
                      {formatFrozenAt(selected.frozenAt) ?? "时间未提供"}
                      {" · "}
                      {visibilityLabel(selected.visibility)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium text-foreground">该版本的摘要</h3>
                    {selected.summary?.trim() ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {selected.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">该版本没有保存摘要。</p>
                    )}
                  </div>

                  <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    版本记录只保存发布时定格的标题、摘要与可见性；<b>正文不会在这里提供预览</b>。
                    恢复后再回到编辑器查看与修改正文。
                  </p>

                  <div className="border-t border-border pt-4">
                    {restorable ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirming(true)}
                      >
                        恢复为当前草稿
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="restore-blocked">
                        {blockedReason}
                      </p>
                    )}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <Link
        to={`/studio/content/${encodeURIComponent(articleId ?? "")}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        返回编辑器
      </Link>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="确认恢复版本"
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-sm text-foreground">
            确定把这个版本恢复为当前草稿吗？<b>当前草稿的内容会被覆盖</b>
            ，建议先另存一份再恢复。
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={pending} onClick={() => void onRestore()}>
              确认恢复
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
