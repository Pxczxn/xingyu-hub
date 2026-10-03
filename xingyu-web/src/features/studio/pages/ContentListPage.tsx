import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary, TrashItem } from "@/api/articles/articles.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  CONTENT_TABS,
  type ContentTab,
  articleListTitle,
  articleStatusLabel,
  canTrash,
  countByStatus,
  filterByTab,
  formatArticleTime,
  splitTrash,
  trashItemTitle,
} from "../content-list";

/*
 * Content management (Phase 3G).
 *
 * WHY THIS PAGE EXISTS: the article editor shipped in Phase 1C (`/studio/content/:articleId`,
 * where `articleId === "new"` opens a blank document), but NO page in V2 linked to it.
 * A signed-in author literally could not start an article without typing the URL by hand.
 * `/studio` even carried a comment explaining the placeholder: "/studio/content has no
 * LIST route ... a link here would 404". This page removes that dead end.
 *
 * The Legacy equivalent is `xingyu-web/app/studio/content/page.tsx` (179 lines).
 *
 * Two things this page deliberately does NOT do, because the API cannot back them:
 *
 *  1. **No bulk actions.** There is no batch endpoint; every action is per-article.
 *  2. **No "delete forever".** `GET /me/trash` + `restore` exist but there is NO
 *     DELETE-from-trash endpoint, so the trash tab offers restore only. Rendering a
 *     "permanently delete" button would be a control that can only fail.
 */

type LoadPhase = "loading" | "error" | "ready";
type Tab = ContentTab;

function isTab(value: string | null): value is Tab {
  return CONTENT_TABS.some((tab) => tab.id === value);
}

export function ContentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  // An unrecognised ?tab= falls back to "all" rather than rendering an empty
  // page — a bad URL should not look like "you have no articles".
  const tab: Tab = isTab(rawTab) ? rawTab : "all";

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [articles, setArticles] = useState<MyArticleSummary[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [trashPhase, setTrashPhase] = useState<LoadPhase>("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadArticles = useCallback(() => {
    setPhase("loading");
    articlesApi
      .listMine()
      .then((data) => {
        setArticles(data);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  const loadTrash = useCallback(() => {
    setTrashPhase("loading");
    articlesApi
      .listTrash()
      .then((data) => {
        setTrash(data);
        setTrashPhase("ready");
      })
      .catch(() => setTrashPhase("error"));
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  /*
   * The trash tab is fed by a DIFFERENT endpoint (GET /me/trash -> TrashItem[]),
   * not by a status filter on the owner list. It is fetched lazily on first visit
   * so the common case (never opening the trash) costs one request fewer.
   */
  useEffect(() => {
    if (tab === "trash" && trashPhase === "loading") loadTrash();
  }, [tab, trashPhase, loadTrash]);

  const visible = useMemo(() => filterByTab(articles, tab), [articles, tab]);
  const counters = useMemo(() => countByStatus(articles), [articles]);
  const { articles: trashArticles, others: trashOthers } = useMemo(
    () => splitTrash(trash),
    [trash],
  );

  async function moveToTrash(article: MyArticleSummary) {
    setBusyId(article.id);
    setActionError(null);
    try {
      await articlesApi.trash(article.id);
      // Re-fetch rather than mutating local state: the row leaves the owner list
      // AND the trash view must be current if the user switches tabs next.
      loadArticles();
      setTrashPhase("loading");
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.problem.detail : "移入回收站失败，请稍后重试。",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function restore(articleId: string) {
    setRestoring(true);
    setActionError(null);
    try {
      await articlesApi.restoreFromTrash(articleId);
      // Restoring moves the row back into the owner list, so both views reload.
      loadTrash();
      loadArticles();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.problem.detail : "恢复失败，请稍后重试。");
    } finally {
      setRestoring(false);
    }
  }

  function selectTab(next: Tab) {
    setActionError(null);
    setSearchParams(next === "all" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">内容管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理你的全部文章：草稿、已发布、审核状态与回收站。
          </p>
        </div>
        {/* THE fix: a real, visible entry point into the editor. Without this link
            the editor was reachable only by hand-typing the URL. */}
        <Link to="/studio/content/new" className={cn(buttonVariants({ variant: "accent" }))}>
          新建文章
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-4" data-testid="content-counters">
        <Counter value={counters.published} label="已发布" />
        <Counter value={counters.draft} label="草稿" />
        <Counter value={counters.review} label="审核中" />
        <Counter value={counters.returned} label="被退回" />
      </div>

      <nav aria-label="内容状态筛选" className="flex flex-wrap gap-2">
        {CONTENT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-muted font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card p-3 text-sm text-foreground"
        >
          {actionError}
        </div>
      ) : null}

      {tab === "trash" ? (
        <TrashPanel
          phase={trashPhase}
          articles={trashArticles}
          others={trashOthers}
          restoring={restoring}
          onRestore={restore}
          onReload={loadTrash}
        />
      ) : phase === "loading" ? (
        <PageState kind="loading" />
      ) : phase === "error" ? (
        <div className="section-gap">
          <PageState kind="error" title="无法加载内容" description="请确认登录状态后重试。" />
          <Button variant="outline" onClick={loadArticles}>
            重新加载
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <PageState kind="empty" title={emptyTitle(tab)} description={emptyHint(tab)} />
      ) : (
        <ul className="grid gap-3" data-testid="content-rows">
          {visible.map((article) => (
            <li key={article.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    to={`/studio/content/${encodeURIComponent(article.id)}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {articleListTitle(article)}
                  </Link>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{articleStatusLabel(article.status)}</span>
                    <span>{formatArticleTime(article.updatedAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link
                    to={`/studio/content/${encodeURIComponent(article.id)}`}
                    className="text-sm text-accent hover:underline"
                  >
                    编辑
                  </Link>
                  <Link
                    to={`/studio/content/${encodeURIComponent(article.id)}/versions`}
                    className="text-sm text-accent hover:underline"
                  >
                    版本历史
                  </Link>
                  {/* Hidden for in-review pieces: TrashService rejects those with
                      409 「审核中的文章不可移入回收站」. */}
                  {canTrash(article) ? (
                    <button
                      type="button"
                      disabled={busyId === article.id}
                      onClick={() => void moveToTrash(article)}
                      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {busyId === article.id ? "移入中…" : "移入回收站"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-lg font-semibold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TrashPanel({
  phase,
  articles,
  others,
  restoring,
  onRestore,
  onReload,
}: {
  phase: LoadPhase;
  articles: TrashItem[];
  others: TrashItem[];
  restoring: boolean;
  onRestore: (articleId: string) => void;
  onReload: () => void;
}) {
  if (phase === "loading") return <PageState kind="loading" />;
  if (phase === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="无法加载回收站" description="请稍后重试。" />
        <Button variant="outline" onClick={onReload}>
          重新加载
        </Button>
      </div>
    );
  }
  if (articles.length === 0 && others.length === 0) {
    return (
      <PageState
        kind="empty"
        title="回收站是空的"
        description="移入回收站的文章会出现在这里，可以恢复。"
      />
    );
  }

  return (
    <div className="section-gap">
      {/*
        Stated up front because the API offers no way to do it: there is no
        DELETE-from-trash endpoint, so "移入回收站" is the end of the line in this
        UI. Promising otherwise would be a lie the backend cannot back.
      */}
      <p className="text-sm text-muted-foreground" data-testid="trash-note">
        回收站中的文章可以恢复；当前版本不提供彻底删除。
      </p>
      <ul className="grid gap-3" data-testid="trash-rows">
        {articles.map((item) => (
          <li key={item.objectId} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{trashItemTitle(item)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatArticleTime(item.trashedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={restoring}
                onClick={() => onRestore(item.objectId)}
                className="text-sm text-accent hover:underline disabled:opacity-50"
              >
                {restoring ? "恢复中…" : "恢复"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        // Non-article rows are surfaced read-only rather than hidden: the shared
        // trash table can hold other object kinds, and silently dropping them
        // would misrepresent the user's data.
        <div className="rounded-lg border border-border bg-card p-4" data-testid="trash-others">
          <p className="text-sm font-medium text-foreground">其他类型的已删除内容</p>
          <p className="mt-1 text-xs text-muted-foreground">
            以下内容来自同一回收站，但当前页面只能恢复文章，暂不提供操作。
          </p>
          <ul className="mt-2 grid gap-1">
            {others.map((item) => (
              <li
                key={`${item.objectType}:${item.objectId}`}
                className="text-xs text-muted-foreground"
              >
                {`${item.objectType} · ${trashItemTitle(item)}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function emptyTitle(tab: Tab): string {
  switch (tab) {
    case "published":
      return "还没有已发布的文章";
    case "drafts":
      return "没有草稿";
    case "reviewing":
      return "没有审核中的文章";
    case "returned":
      return "没有被退回的文章";
    default:
      return "还没有文章";
  }
}

function emptyHint(tab: Tab): string {
  switch (tab) {
    case "published":
      return "文章通过审核发布后会出现在这里。";
    case "drafts":
      return "点「新建文章」开始写第一篇。";
    case "reviewing":
      return "提交审核的稿件会出现在这里。";
    case "returned":
      return "被审核退回的稿件会出现在这里，可以修改后重新提交。";
    default:
      return "点「新建文章」开始写第一篇。";
  }
}
