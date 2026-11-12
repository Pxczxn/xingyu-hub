import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary, TrashItem } from "@/api/articles/articles.types";
import { ApiError } from "@/api/client";
import { ArchetypeFrame, TableFrame } from "@/components/layout";
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
  filterByQuery,
  filterByTab,
  formatArticleTime,
  splitTrash,
  trashItemTitle,
} from "../content-list";

/*
 * Content management (Phase 3G).
 *
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 表 / R 齐
 * --------------------------------------------------
 *   SK3 + 无 `rail` ⇒ `SOLO.SK3`：单列、与内容列同宽同边，即 R=齐。
 *   H=壳：`WorkbenchShell` 不输出 heading（`WorkbenchShell.tsx:15-29`，被
 *        `studio-2n-routes.test.tsx` 反向钉住），所以页内必须恰好 1 个 `h1`；
 *        本页首块是量化带、视觉没有标题位，因此用 `sr-only`（A §7.2）。
 *   D=表：这一页的正文是**可比较的清单**（状态 / 更新时间 / 可执行的操作三列对齐），
 *        所以走 `TableFrame` 而不是逐项卡面 —— 这也是同一份数据与 `D=紧` 的
 *        我的投稿、`D=松` 的投稿详情区分开的地方（A §2 五条硬约束第 5 条）。
 *
 * WHY THIS PAGE EXISTS: the article editor shipped in Phase 1C (`/studio/content/:articleId`,
 * where `articleId === "new"` opens a blank document), but NO page in V2 linked to it.
 * A signed-in author literally could not start an article without typing the URL by hand.
 *
 * The Legacy equivalent is `xingyu-web/app/studio/content/page.tsx` (179 lines).
 *
 * Two things this page deliberately does NOT do, because the API cannot back them:
 *
 *  1. **No bulk actions.** There is no batch endpoint; every action is per-article.
 *  2. **No "delete forever".** `GET /me/trash` + `restore` exist but there is NO
 *     DELETE-from-trash endpoint, so the trash tab offers restore only. Rendering a
 *     "permanently delete" button would be a control that can only fail.
 *
 * 工具栏（搜索 + 筛选 + 新建）在量化带之下、表格之上：搜索只搜**当前标签页**内的
 * 标题（`filterByQuery`），回收站标签页下架搜索框 —— 它读的是另一个端点、另一种
 * 行结构，一个「静默什么也搜不到」的框比没有框更糟。
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
  const [query, setQuery] = useState("");

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

  /*
   * Two stacked filters, in this order: the tab narrows by status, the query then
   * narrows by title WITHIN it. Searching across tabs instead would contradict the
   * highlighted tab — the user would be told they are looking at 草稿 while staring
   * at a published piece.
   */
  const tabbed = useMemo(() => filterByTab(articles, tab), [articles, tab]);
  const visible = useMemo(() => filterByQuery(tabbed, query), [tabbed, query]);
  const counters = useMemo(() => countByStatus(articles), [articles]);
  const { articles: trashArticles, others: trashOthers } = useMemo(
    () => splitTrash(trash),
    [trash],
  );

  /*
   * The search box is shown only when there is something it could search. It is
   * withheld on the trash tab (different endpoint, different row shape) and while
   * the owner list is loading, empty or failed. Keyed off `articles.length`, not
   * the tab's own count, so switching tabs does not make the box flicker in and out.
   */
  const showSearch = phase === "ready" && tab !== "trash" && articles.length > 0;
  const searching = query.trim().length > 0;

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
    <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
      {/* B 类壳：恰好 1 个 h1，视觉隐藏；首块仍是内容（量化带）。 */}
      <h1 className="sr-only">内容管理</h1>

      {/* 量化带：一个面、被发丝线切开的格子，三个计数用同一把尺子。 */}
      <div
        data-testid="content-counters"
        className="overflow-hidden rounded-card border border-border/70 bg-border/60"
      >
        <ul aria-label="内容计数" className="grid grid-cols-3 gap-px">
          <Counter value={counters.published} label="已发布" />
          <Counter value={counters.draft} label="草稿" />
          <Counter value={counters.review} label="审核中" />
          {/* 「被退回」计数与 Tab 一同下线（Studio Seal Final Closure）：后端无完整
              的"每篇文章最新审核结果"查询，展示不完整窗口即虚假承诺。见
              docs/studio-static-design-final-fix-2026-10-09.md Product Debt。 */}
        </ul>
      </div>

      {/*
        工具栏（§3.6: 搜索 + 筛选 + 新建）。搜与筛在左、新建在右，读作一行控件；
        它落在量化带与表格之间，所以表格为空时这一行仍然在，用户不会失去出口。
      */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showSearch ? (
            <div className="flex w-full min-w-0 items-center gap-2 sm:max-w-md">
              <label className="relative block w-full min-w-0">
                <span className="sr-only">搜索文章</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                {/*
                  `type="search"` maps to the ARIA `searchbox` role, NOT `textbox`
                  (see the note in the shared SearchField, which uses `type="text"`
                  to keep a `getByRole("textbox")` contract). Nothing on this page
                  queries it as a textbox, so the honest role wins: tests should
                  reach it with `getByRole("searchbox", { name: "搜索文章" })`.
                */}
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题"
                  className="focus-ring h-9 w-full rounded-control border border-input bg-surface-sunken/60 pl-9 pr-3 text-meta text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-accent focus-visible:bg-card"
                />
              </label>
              {/*
                A <button>, never a <Link>: this page's contract test asserts that
                every link on it resolves into /studio/content, and clearing a local
                input navigates nowhere.
              */}
              {searching ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="focus-ring shrink-0 rounded-sm text-caption text-muted-foreground transition-colors hover:text-accent-strong"
                >
                  清除搜索
                </button>
              ) : null}
            </div>
          ) : (
            <span />
          )}

          {/* THE fix: a real, visible entry point into the editor. Without this link
              the editor was reachable only by hand-typing the URL. */}
          <Link
            to="/studio/content/new"
            className={cn(buttonVariants({ size: "sm" }), "ml-auto shrink-0")}
          >
            新建文章
          </Link>
        </div>

        <nav aria-label="内容状态筛选" className="flex flex-wrap gap-2">
          {CONTENT_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "focus-ring rounded-chip border px-3 py-1.5 text-meta transition-colors",
                tab === item.id
                  ? "border-border-strong/50 bg-muted font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-control border border-border bg-card p-3 text-meta text-foreground"
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
        <div className="flex flex-col items-start gap-3">
          <PageState kind="error" title="无法加载内容" description="请确认登录状态后重试。" />
          <Button variant="outline" onClick={loadArticles}>
            重新加载
          </Button>
        </div>
      ) : (
        /*
         * Two different empty states, and conflating them would lie:
         *  - the tab itself is empty, or the query is blank  -> the tab's own copy;
         *  - the tab HAS rows but the query matches none      -> a search message.
         * Showing 「还没有文章」 to an author who has twenty and merely typed a
         * keyword is the kind of falsehood this branch exists to prevent.
         *
         * 空态走 `TableFrame` 的 `emptyState` 槽：空表只剩表头，是数据页能说的最强
         * 的谎（`TableFrame` 的契约就是「不渲染表」）。
         */
        <TableFrame
          caption="内容列表"
          emptyState={
            visible.length > 0 ? undefined : searching && tabbed.length > 0 ? (
              <PageState
                kind="empty"
                title="没有匹配的文章"
                description="换个关键词试试，或清空搜索查看全部内容。"
              />
            ) : (
              <PageState kind="empty" title={emptyTitle(tab)} description={emptyHint(tab)} />
            )
          }
        >
          <thead>
            <tr>
              <th scope="col">标题</th>
              <th scope="col" className="w-[1%] whitespace-nowrap">
                状态
              </th>
              <th scope="col" className="w-[1%] whitespace-nowrap">
                更新时间
              </th>
              <th scope="col" className="w-[1%] whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody data-testid="content-rows">
            {visible.map((article) => (
              <tr key={article.id} className="hover:bg-surface-sunken/60">
                <td>
                  <Link
                    to={`/studio/content/${encodeURIComponent(article.id)}`}
                    className="focus-ring rounded-sm text-meta font-medium text-foreground hover:text-accent-strong"
                  >
                    {articleListTitle(article)}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-meta text-muted-foreground">
                  {articleStatusLabel(article.status)}
                </td>
                <td className="whitespace-nowrap text-meta tabular-nums text-muted-foreground">
                  {formatArticleTime(article.updatedAt)}
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      to={`/studio/content/${encodeURIComponent(article.id)}`}
                      className="focus-ring rounded-sm text-meta text-accent-strong hover:underline"
                    >
                      编辑
                    </Link>
                    <Link
                      to={`/studio/content/${encodeURIComponent(article.id)}/versions`}
                      className="focus-ring rounded-sm text-meta text-accent-strong hover:underline"
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
                        className="focus-ring rounded-sm text-meta text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {busyId === article.id ? "移入中…" : "移入回收站"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </ArchetypeFrame>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <li className="bg-card px-4 py-3">
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className="mt-1 text-h2 tabular-nums text-primary">{value}</p>
    </li>
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
      <div className="flex flex-col items-start gap-3">
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
    <div className="flex flex-col gap-3">
      {/*
        Stated up front because the API offers no way to do it: there is no
        DELETE-from-trash endpoint, so "移入回收站" is the end of the line in this
        UI. Promising otherwise would be a lie the backend cannot back.
      */}
      <p className="text-meta text-muted-foreground" data-testid="trash-note">
        回收站中的文章可以恢复；当前版本不提供彻底删除。
      </p>

      <TableFrame caption="回收站">
        <thead>
          <tr>
            <th scope="col">标题</th>
            <th scope="col" className="w-[1%] whitespace-nowrap">
              移入时间
            </th>
            <th scope="col" className="w-[1%] whitespace-nowrap">
              操作
            </th>
          </tr>
        </thead>
        <tbody data-testid="trash-rows">
          {articles.map((item) => (
            <tr key={item.objectId} className="hover:bg-surface-sunken/60">
              <td className="text-meta font-medium text-foreground">{trashItemTitle(item)}</td>
              <td className="whitespace-nowrap text-meta tabular-nums text-muted-foreground">
                {formatArticleTime(item.trashedAt)}
              </td>
              <td className="whitespace-nowrap">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={() => onRestore(item.objectId)}
                    className="focus-ring rounded-sm text-meta text-accent-strong hover:underline disabled:opacity-50"
                  >
                    {restoring ? "恢复中…" : "恢复"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableFrame>

      {others.length > 0 ? (
        // Non-article rows are surfaced read-only rather than hidden: the shared
        // trash table can hold other object kinds, and silently dropping them
        // would misrepresent the user's data.
        <div
          className="rounded-card border border-border/70 bg-card p-4"
          data-testid="trash-others"
        >
          <p className="text-meta font-medium text-foreground">其他类型的已删除内容</p>
          <p className="mt-1 text-meta text-muted-foreground">
            以下内容来自同一回收站，但当前页面只能恢复文章，暂不提供操作。
          </p>
          <ul className="mt-2 grid gap-1">
            {others.map((item) => (
              <li
                key={`${item.objectType}:${item.objectId}`}
                className="text-caption text-muted-foreground"
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
    default:
      return "点「新建文章」开始写第一篇。";
  }
}
