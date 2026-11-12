import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleRevision, ArticleLifecycleStatus } from "@/api/articles/articles.types";
import { ArchetypeFrame, TableFrame } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 表 / R 齐
 * --------------------------------------------------
 *   SK3 + 无 `rail` ⇒ `SOLO.SK3`：单列、与内容列同宽同边（R=齐）。原来那套
 *   `lg:grid-cols-[1fr_1.2fr]` 的主从双栏是另一种节奏，也与本页在映射表里的
 *   R=齐 不符，故收起。
 *   H=壳：`WorkbenchShell` 无 heading（`WorkbenchShell.tsx:15-29`），页内必须恰好
 *        1 个 `h1`；首块是量化带、没有视觉标题位 → `sr-only`（A §7.2）。
 *   D=表：历史版本本来就是**可比较**的数据 —— 版本号 / 标题 / 发布时间 / 可见性
 *        四列对齐之后，"哪一版是什么时候、对谁可见" 一眼可比。所以列表换成
 *        `TableFrame` 的表行；选中仍然是显式控件（`aria-pressed` 的行内按钮），
 *        不做整行可点 —— 行内还有别的焦点目标时，整行可点会吞掉键盘。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `signal` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (signal: { active: boolean }) => {
      if (!articleId) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "loading" });
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
    },
    [articleId],
  );

  useEffect(() => {
    const signal = { active: true };
    void load(signal);
    return () => {
      signal.active = false;
    };
  }, [load, reloadKey]);

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
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载版本历史失败"
          description="无法读取这篇文章的历史版本，请稍后重试。"
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
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
  const latestFrozenAt = revisions.length > 0 ? formatFrozenAt(revisions[0]?.frozenAt) : null;

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
      {/* B 类壳：恰好 1 个 h1，视觉隐藏；首块仍是内容（量化带）。 */}
      <h1 className="sr-only">历史版本</h1>

      <p className="text-meta leading-6 text-muted-foreground">
        查看这篇文章每次发布时定格的版本，并可将其中一个恢复为当前草稿。
      </p>

      {/* 量化带：三个可复核的数字，同一把尺子。 */}
      <div className="overflow-hidden rounded-card border border-border/70 bg-border/60">
        <ul aria-label="版本概况" className="grid grid-cols-3 gap-px">
          <li className="bg-card px-4 py-3">
            <p className="text-meta text-muted-foreground">历史版本</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-h2 tabular-nums text-primary">{revisions.length}</span>
              <span className="text-caption text-muted-foreground">个</span>
            </p>
          </li>
          <li className="bg-card px-4 py-3">
            <p className="text-meta text-muted-foreground">本页显示</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-h2 tabular-nums text-primary">{displayed.length}</span>
              <span className="text-caption text-muted-foreground">
                / 上限 {REVISION_DISPLAY_LIMIT}
              </span>
            </p>
          </li>
          <li className="bg-card px-4 py-3">
            <p className="text-meta text-muted-foreground">最近定格</p>
            <p className="mt-1 truncate text-meta text-foreground">
              {latestFrozenAt ?? "时间未提供"}
            </p>
          </li>
        </ul>
      </div>

      {actionError ? (
        <p
          role="alert"
          className="rounded-control border border-destructive/40 bg-card p-3 text-meta text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {restored ? (
        <p
          role="status"
          className="rounded-control border border-border bg-card p-3 text-meta text-foreground"
        >
          已恢复为当前草稿。
          <Link
            to={`/studio/content/${encodeURIComponent(articleId ?? "")}`}
            className="ml-1 text-accent-strong hover:underline"
          >
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
        <>
          {/* 「版本列表」之所以是这一层的 aria-label：下面同时有表格标题与选中详情，
              测试与读屏都靠这个名字圈定"列表本身"。 */}
          <section aria-label="版本列表" className="min-w-0">
            <TableFrame caption="历史版本">
              <thead>
                <tr>
                  <th scope="col" className="w-[1%] whitespace-nowrap">
                    选择
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap">
                    版本
                  </th>
                  <th scope="col">标题</th>
                  <th scope="col" className="w-[1%] whitespace-nowrap">
                    定格时间
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap">
                    可见性
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((revision) => {
                  const active = selected?.id === revision.id;
                  return (
                    <tr
                      key={revision.id}
                      data-selected={active ? "true" : undefined}
                      className={active ? "bg-muted/70" : "hover:bg-surface-sunken/60"}
                    >
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedId(revision.id)}
                          aria-pressed={active}
                          /* 可判定的可访问名：读屏听到的是「哪个版本」而不是「选择」。 */
                          aria-label={`选择此版本：${revisionLabel(revision)} · ${revisionTitle(revision)}`}
                          className="focus-ring rounded-sm text-meta text-accent-strong hover:underline"
                        >
                          {active ? "已选" : "选择"}
                        </button>
                      </td>
                      <td className="whitespace-nowrap text-meta tabular-nums text-muted-foreground">
                        {revisionLabel(revision)}
                      </td>
                      <td className="text-meta font-medium text-foreground">
                        {revisionTitle(revision)}
                      </td>
                      <td className="whitespace-nowrap text-meta tabular-nums text-muted-foreground">
                        {formatFrozenAt(revision.frozenAt) ?? "时间未提供"}
                      </td>
                      <td className="whitespace-nowrap text-meta text-muted-foreground">
                        {visibilityLabel(revision.visibility)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableFrame>
          </section>

          {selected ? (
            <section
              aria-labelledby="version-detail-heading"
              className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
            >
              <div className="flex flex-col gap-1">
                <h2 id="version-detail-heading" className="text-h3 break-words text-primary">
                  {revisionTitle(selected)}
                </h2>
                <p className="text-meta text-muted-foreground">
                  {revisionLabel(selected)}
                  {" · "}
                  {formatFrozenAt(selected.frozenAt) ?? "时间未提供"}
                  {" · "}
                  {visibilityLabel(selected.visibility)}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-meta font-medium text-foreground">该版本的摘要</h3>
                {selected.summary?.trim() ? (
                  <p className="whitespace-pre-wrap text-meta leading-6 text-muted-foreground">
                    {selected.summary}
                  </p>
                ) : (
                  <p className="text-meta text-muted-foreground">该版本没有保存摘要。</p>
                )}
              </div>

              <p className="rounded-control border border-border bg-surface-sunken/60 p-3 text-caption leading-5 text-muted-foreground">
                版本记录只保存发布时定格的标题、摘要与可见性；<b>正文不会在这里提供预览</b>。
                恢复后再回到编辑器查看与修改正文。
              </p>

              <div className="border-t border-border/70 pt-4">
                {restorable ? (
                  /* 浮层统一：确认块收敛到 `components/ui/dialog`（role="alertdialog"）。
                     旧实现是挂了 aria-modal 却没有遮罩、没有焦点陷阱的行内块。 */
                  <Dialog open={confirming} onOpenChange={setConfirming}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="default" size="sm" disabled={pending}>
                        恢复为当前草稿
                      </Button>
                    </DialogTrigger>
                    <DialogContent role="alertdialog" className="max-w-sm rounded-xl bg-card">
                      <DialogTitle className="text-base font-semibold text-primary">
                        确认恢复版本
                      </DialogTitle>
                      <DialogDescription className="text-sm leading-6 text-muted-foreground">
                        确定把这个版本恢复为当前草稿吗？<b>当前草稿的内容会被覆盖</b>
                        ，建议先另存一份再恢复。
                      </DialogDescription>
                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => setConfirming(false)}
                        >
                          取消
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => void onRestore()}
                        >
                          确认恢复
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <p className="text-meta text-muted-foreground" data-testid="restore-blocked">
                    {blockedReason}
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Link
        to={`/studio/content/${encodeURIComponent(articleId ?? "")}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        返回编辑器
      </Link>
    </ArchetypeFrame>
  );
}
