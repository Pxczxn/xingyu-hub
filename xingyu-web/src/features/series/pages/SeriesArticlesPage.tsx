import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail, SeriesStatus } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ArticlePickerPanel } from "../components/ArticlePickerPanel";
import { ChapterOrderList } from "../components/ChapterOrderList";
import { SeriesLeaveGuard } from "../components/SeriesLeaveGuard";
import { SeriesStatusBadge } from "../components/SeriesStatusBadge";
import {
  apiErrorDetail,
  articleDisplayTitle,
  isConflictError,
  isNotFoundError,
} from "../series-labels";
import {
  chapterIds,
  moveChapterEntry,
  removeChapterEntry,
  reorderChapterEntries,
  restoreChapterEntry,
  sameChapterOrder,
  toChapterEntries,
  type ChapterEntry,
} from "../series-order";

type LoadState = "loading" | "error" | "notfound" | "ready";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type ConflictReloadState = "idle" | "confirm" | "loading";

/**
 * Chapter arrangement — the creator workbench's core surface (Phase 5C).
 *
 * The API has no per-chapter endpoints. Saving is a full replacement of the
 * relation table (`PUT /me/series/{id}` with `chapterArticleIds` + `lockVersion`),
 * so this page models the arrangement as one local draft:
 *
 *   - add / remove / drag / up-down only mutate LOCAL state;
 *   - removal only drops the relation — the article itself is never touched;
 *   - one save submits the final article-id order, and nothing is sent when the
 *     order is unchanged;
 *   - a 409 never overwrites local work and never grabs the new version to
 *     silently resubmit; the user explicitly reloads the server copy.
 */
export function SeriesArticlesPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesStatus, setSeriesStatus] = useState<SeriesStatus>("ACTIVE");
  const [lockVersion, setLockVersion] = useState(0);
  const [chapters, setChapters] = useState<ChapterEntry[]>([]);
  const [baselineIds, setBaselineIds] = useState<string[]>([]);
  const [articles, setArticles] = useState<MyArticleSummary[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [conflictReload, setConflictReload] = useState<ConflictReloadState>("idle");
  const [lastRemoved, setLastRemoved] = useState<{ entry: ChapterEntry; index: number } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  /* Bumping the key replays the load effect — the retry mechanism. */
  const [reloadKey, setReloadKey] = useState(0);

  /* Latest series id, for discarding responses that arrive after a route switch. */
  const idRef = useRef(id);
  /* Counts local edits; a save response may only replace the list when the
     revision it started from is still current. */
  const revisionRef = useRef(0);
  const sessionRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const applyDetail = useCallback((detail: SeriesDetail, list: MyArticleSummary[]) => {
    const entries = toChapterEntries(detail.chapters);
    setSeriesTitle(detail.title);
    setSeriesStatus(detail.status);
    setLockVersion(detail.lockVersion);
    setChapters(entries);
    setBaselineIds(chapterIds(entries));
    setArticles(list);
    setLoadedId(detail.id);
    setSaveState("idle");
    setSaveError(null);
    setSaveMessage(null);
    setConflictReload("idle");
    setLastRemoved(null);
    revisionRef.current += 1;
  }, []);

  useEffect(() => {
    if (!id) {
      setLoadState("notfound");
      return;
    }
    let active = true;
    savingRef.current = false;
    setLoadState("loading");
    setLoadedId(null);
    setSeriesTitle("");
    setChapters([]);
    setBaselineIds([]);
    setArticles([]);
    setSaveState("idle");
    setSaveError(null);
    setSaveMessage(null);
    setConflictReload("idle");
    setLastRemoved(null);
    setPickerOpen(false);
    revisionRef.current += 1;

    Promise.all([seriesApi.getMine(id), articlesApi.listMine()])
      .then(([detail, list]) => {
        if (!active) return;
        applyDetail(detail, list);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadState(isNotFoundError(error) ? "notfound" : "error");
      });
    return () => {
      active = false;
      sessionRef.current += 1;
    };
  }, [id, reloadKey, applyDetail]);

  const articleById = useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  );
  const selectedIds = useMemo(
    () => new Set(chapters.map((chapter) => chapter.articleId)),
    [chapters],
  );
  const dirty = useMemo(
    () => !sameChapterOrder(chapterIds(chapters), baselineIds),
    [chapters, baselineIds],
  );

  function markEdited() {
    revisionRef.current += 1;
    setSaveError(null);
    setSaveMessage(null);
    /* A request in flight keeps its own status; a conflict keeps its panel. */
    setSaveState((current) => (current === "saving" || current === "conflict" ? current : "idle"));
    setConflictReload("idle");
  }

  function addArticle(article: MyArticleSummary) {
    if (chapters.some((chapter) => chapter.articleId === article.id)) return;
    setChapters((current) =>
      current.some((chapter) => chapter.articleId === article.id)
        ? current
        : [...current, { articleId: article.id, title: article.title }],
    );
    markEdited();
  }

  function removeChapter(articleId: string) {
    const result = removeChapterEntry(chapters, articleId);
    if (!result.removed) return;
    setChapters(result.next);
    setLastRemoved(result.removed);
    markEdited();
  }

  function undoRemove() {
    if (!lastRemoved) return;
    setChapters((current) => restoreChapterEntry(current, lastRemoved.entry, lastRemoved.index));
    setLastRemoved(null);
    markEdited();
  }

  function moveChapter(articleId: string, delta: number) {
    setChapters((current) =>
      moveChapterEntry(
        current,
        current.findIndex((chapter) => chapter.articleId === articleId),
        delta,
      ),
    );
    markEdited();
  }

  function reorderChapters(activeId: string, overId: string) {
    setChapters((current) => reorderChapterEntries(current, activeId, overId));
    markEdited();
  }

  async function onSave() {
    if (!id || !dirty || savingRef.current || saveState === "conflict") return;
    const requestSeriesId = id;
    const session = sessionRef.current;
    savingRef.current = true;
    const requestIds = chapterIds(chapters);
    const revisionAtStart = revisionRef.current;
    setSaveState("saving");
    setSaveError(null);
    setSaveMessage(null);
    setConflictReload("idle");

    let updated: SeriesDetail;
    try {
      updated = await seriesApi.update(requestSeriesId, {
        chapterArticleIds: requestIds,
        lockVersion,
      });
    } catch (error) {
      if (idRef.current !== requestSeriesId || sessionRef.current !== session) return;
      savingRef.current = false;
      if (isConflictError(error)) {
        setSaveState("conflict");
      } else {
        setSaveState("error");
        setSaveError(apiErrorDetail(error, "保存失败，请稍后重试。"));
      }
      return;
    }
    if (idRef.current !== requestSeriesId || sessionRef.current !== session) return;

    /* Re-read to verify what actually landed. A failed verification still keeps
       the PUT response, which is built from the database. */
    let authoritative = updated;
    let verified = true;
    try {
      const verifiedDetail = await seriesApi.getMine(requestSeriesId);
      if (verifiedDetail.lockVersion >= updated.lockVersion) authoritative = verifiedDetail;
    } catch {
      verified = false;
    }
    if (idRef.current !== requestSeriesId || sessionRef.current !== session) return;

    savingRef.current = false;
    if (
      revisionRef.current !== revisionAtStart &&
      authoritative.lockVersion !== updated.lockVersion
    ) {
      setLockVersion(updated.lockVersion);
      setBaselineIds(chapterIds(toChapterEntries(updated.chapters)));
      setSaveState("conflict");
      setSaveMessage(
        "上一版已保存；校验时发现其他编辑更新，本地新修改已保留。请确认后载入服务端版本。",
      );
      return;
    }
    setSeriesTitle(authoritative.title);
    setSeriesStatus(authoritative.status);
    const serverEntries = toChapterEntries(authoritative.chapters);
    setLockVersion(authoritative.lockVersion);
    setBaselineIds(chapterIds(serverEntries));

    if (revisionRef.current === revisionAtStart) {
      setChapters(serverEntries);
      setSaveState("saved");
      if (!sameChapterOrder(chapterIds(serverEntries), requestIds)) {
        setSaveMessage("已保存，但服务端返回的顺序与提交不同，已按服务端结果更新。");
      } else if (!verified) {
        setSaveMessage("已保存。未能重新读取校验，当前显示的是保存响应。");
      } else if (authoritative.lockVersion !== updated.lockVersion) {
        setSaveMessage("已保存，但系列随后又被其他编辑更新；当前显示最新服务端内容。");
      } else {
        setSaveMessage("已保存。");
      }
    } else {
      /* Local edits landed while the request was in flight. Keep them; adopt
         the new version so the next save is based on the persisted state. */
      setSaveState("idle");
      setSaveMessage("已保存上一版编排；保存期间的修改尚未提交。");
    }
  }

  async function reloadServerAfterConflict() {
    if (!id) return;
    const session = sessionRef.current;
    const revision = revisionRef.current;
    setConflictReload("loading");
    try {
      const detail = await seriesApi.getMine(id);
      if (idRef.current !== id || sessionRef.current !== session) return;
      if (revisionRef.current !== revision) {
        setConflictReload("idle");
        setSaveMessage("读取期间又有修改，已保留本地内容；请重新确认是否载入服务端版本。");
        return;
      }
      applyDetail(detail, articles);
      setSaveState("saved");
      setSaveMessage("已载入服务端最新编排。");
    } catch (error) {
      if (idRef.current !== id || sessionRef.current !== session) return;
      setConflictReload("idle");
      setSaveState("conflict");
      setSaveError(apiErrorDetail(error, "重新读取失败，请稍后重试。"));
    }
  }

  if (loadState === "loading" || (loadState === "ready" && loadedId !== id)) {
    return <PageState kind="loading" />;
  }
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" description="系列编排加载失败，请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <BackLink />
        </p>
      </div>
    );
  }
  if (loadState === "notfound" || loadedId !== id) {
    return (
      <div className="section-gap">
        <PageState kind="empty" title="系列不存在或无权编辑" />
        <BackLink />
      </div>
    );
  }

  const statusText =
    saveState === "saving"
      ? "保存中…"
      : saveState === "conflict"
        ? "版本冲突"
        : saveState === "error"
          ? "保存失败"
          : dirty
            ? "有未保存的修改"
            : saveState === "saved"
              ? "已保存"
              : "已是最新";
  const statusTone =
    saveState === "conflict" || saveState === "error"
      ? "text-destructive"
      : dirty
        ? "text-accent-strong"
        : "text-muted-foreground";

  return (
    <>
      <SeriesLeaveGuard
        when={dirty}
        title="有未保存的章节编排"
        description="离开当前页面会丢失尚未保存的添加、移除和排序，确定要离开吗？"
      />
      <div className="section-gap">
        <header>
          <BackLink />
          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold tracking-tight text-primary">
                  {seriesTitle}
                </h1>
                <SeriesStatusBadge status={seriesStatus} />
              </div>
              <p className="mt-1 text-meta text-muted-foreground">
                {`${chapters.length} 章 · 拖动章节或使用上移 / 下移调整顺序`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta">
                <Link
                  to={`/studio/series/${encodeURIComponent(id)}/edit`}
                  className="focus-ring rounded-sm text-accent-strong hover:underline"
                >
                  编辑系列信息
                </Link>
                {seriesStatus === "ACTIVE" ? (
                  <Link
                    to={`/series/${encodeURIComponent(id)}`}
                    className="focus-ring rounded-sm text-muted-foreground hover:text-accent-strong"
                  >
                    查看公开页
                  </Link>
                ) : (
                  <span className="text-muted-foreground">已归档，公开页暂不可访问</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span role="status" aria-live="polite" className={cn("text-meta", statusTone)}>
                {statusText}
              </span>
              <Button
                type="button"
                onClick={() => void onSave()}
                disabled={!dirty || saveState === "saving" || saveState === "conflict"}
              >
                {saveState === "saving" ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section aria-labelledby="series-chapters-heading" className="order-2 min-w-0 lg:order-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="series-chapters-heading" className="section-heading">
                已收录章节
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setPickerOpen((open) => !open)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {pickerOpen ? "收起选文" : "添加文章"}
              </Button>
            </div>

            {lastRemoved ? (
              <div
                role="status"
                className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent-line bg-accent-soft/60 px-3 py-2 text-xs text-foreground"
              >
                <span>
                  {`已从编排中移除《${articleDisplayTitle(lastRemoved.entry.title)}》。只解除关联，文章没有被删除。`}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 px-1"
                  onClick={undoRemove}
                >
                  撤销
                </Button>
              </div>
            ) : null}

            {chapters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">还没有收录章节</p>
                <p className="mx-auto mt-1 max-w-md text-meta leading-5 text-muted-foreground">
                  从你的文章中选择章节加入。草稿也可以先编排，文章公开后读者才能阅读。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setPickerOpen(true)}
                >
                  添加文章
                </Button>
              </div>
            ) : (
              <ChapterOrderList
                chapters={chapters}
                articleById={articleById}
                onMove={moveChapter}
                onRemove={removeChapter}
                onReorder={reorderChapters}
              />
            )}

            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              移除只解除系列关联，不会删除文章；添加、移除和排序需保存后生效。已发布章节仍受文章可见性与访问权限限制。
            </p>

            {saveState === "conflict" ? (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              >
                <p className="text-sm font-medium text-destructive">
                  版本冲突：服务端存在其他编辑的更新，请先处理冲突后再保存。
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {`你当前的 ${chapters.length} 章编排仍保留在本页。载入服务端版本会丢弃这些未保存的修改，因此需要你确认。`}
                </p>
                {conflictReload === "confirm" || conflictReload === "loading" ? (
                  <div
                    role="group"
                    aria-label="确认载入服务端版本"
                    className="mt-2 rounded-lg border border-border bg-card p-3"
                  >
                    <p className="text-xs leading-5 text-foreground">
                      载入会覆盖你当前未保存的章节顺序和移除操作。确定继续吗？
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={conflictReload === "loading"}
                        onClick={() => void reloadServerAfterConflict()}
                      >
                        {conflictReload === "loading" ? "读取中…" : "确认载入"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={conflictReload === "loading"}
                        onClick={() => setConflictReload("idle")}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setConflictReload("confirm")}
                  >
                    载入服务端最新编排
                  </Button>
                )}
              </div>
            ) : null}

            {saveError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {saveError}
              </p>
            ) : null}
            {saveMessage ? (
              <p role="status" aria-live="polite" className="mt-3 text-meta text-muted-foreground">
                {saveMessage}
              </p>
            ) : null}
          </section>

          <ArticlePickerPanel
            articles={articles}
            selectedIds={selectedIds}
            open={pickerOpen}
            onAdd={addArticle}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/studio/series"
      className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-accent-strong hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      返回系列管理
    </Link>
  );
}
