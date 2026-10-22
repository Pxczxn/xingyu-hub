import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyContent, GalaxyContentSubmission } from "@/api/galaxies/galaxies.types";
import { contentHref } from "@/components/shared/ContentCard";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { staggerDelay } from "@/lib/stagger";
import {
  GALAXY_CONTENT_FILTERS,
  type GalaxyContentFilter,
  galaxyContentTypeLabel,
} from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: GalaxyContent[] };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Galaxy content feed (Phase 2H).
 *
 * Backend: `GET /api/v1/galaxies/{slug}/content?limit=N`, default 20. Each row
 * carries an `objectType` + `objectId` pair, never a resolved path — the link is
 * derived through the shared `contentHref`, so an unmapped type degrades to
 * /discover instead of emitting a dead URL.
 *
 * Sorting is client-side: pinned first, then the order the backend returned.
 */
export function GalaxyContentPage() {
  return (
    <GalaxyShell activeTab="content">
      {(galaxy) => (
        <>
          {/* joined 为 viewer-scoped 三态：只有 true 才可能通过成员校验。 */}
          {galaxy.joined === true ? <GalaxyContributionSection slug={galaxy.slug} /> : null}
          <GalaxyContentFeed slug={galaxy.slug} />
        </>
      )}
    </GalaxyShell>
  );
}

const CONTENT_LIMIT = 30;

function GalaxyContentFeed({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [filter, setFilter] = useState<GalaxyContentFilter>(null);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    galaxiesApi
      .listContent(slug, CONTENT_LIMIT)
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "ready" : "error", items: [] } as LoadState);
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  const rawItems = state.kind === "ready" ? state.items : [];

  const visible = useMemo(() => {
    const rows = rawItems.filter((item) => {
      if (pinnedOnly && !item.pinned) return false;
      if (filter && item.objectType.toUpperCase() !== filter) return false;
      return true;
    });
    return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [rawItems, pinnedOnly, filter]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="内容加载失败" description="请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageSection id="galaxy-content" title="关联内容" description={`共 ${rawItems.length} 条`}>
      {rawItems.length === 0 ? (
        <PageState kind="empty" title="暂无内容" description="运营关联的内容会展示在这里。" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {GALAXY_CONTENT_FILTERS.map((option) => (
              <Button
                key={option.label}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              variant={pinnedOnly ? "default" : "outline"}
              size="sm"
              aria-pressed={pinnedOnly}
              onClick={() => setPinnedOnly((value) => !value)}
            >
              仅看置顶
            </Button>
          </div>

          {visible.length === 0 ? (
            <PageState
              kind="empty"
              title="暂无匹配内容"
              description="当前筛选条件下没有可展示的内容。"
            />
          ) : (
            /*
              `key` carries BOTH controls, because to the reader the type chips
              and 仅看置顶 are one filter: a key that tracked only one of them
              would replay for half the switches and not the other half. A new
              key unmounts the list, so the rows animate in for the filter just
              applied — same mechanism as MyEventsPage, same reason (a filter
              that swaps content with no motion reads as a filter that did
              nothing). Delays are inline because `animate-rise-in` is the
              `animation` shorthand and resets `animation-delay` (stagger.ts).
            */
            <ul
              key={`filter=${filter ?? "all"}&pinned=${pinnedOnly}`}
              className="mt-3 divide-y divide-border rounded-lg border border-border bg-card"
            >
              {visible.map((item, index) => (
                <li
                  key={item.id}
                  className="animate-rise-in flex flex-wrap items-center gap-3 px-4 py-3"
                  style={{ animationDelay: staggerDelay(index) }}
                >
                  <Link
                    to={contentHref({ id: item.objectId, objectType: item.objectType })}
                    className="text-sm font-medium hover:text-accent-strong"
                  >
                    {item.title}
                  </Link>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {galaxyContentTypeLabel(item.objectType)}
                  </span>
                  {item.pinned ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-strong">
                      置顶
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageSection>
  );
}

/* -------------------------------------------------------------------------
 * 内容推荐（Galaxy Content Contribution，V054）
 *
 * 成员把自己的作品推荐进星系，管理员审核通过后由后端写入 galaxy_content，
 * 于是它会出现在上面的「关联内容」里 —— 提交者不需要学第二套发布流程。
 *
 * 前端不复制后端的资格判断（是否成员、作品是否公开、是否已上架）：这些规则
 * 只在服务端成立，前端复制一份就会与业务契约漂移。这里只做一次粗筛（草稿
 * 没有发布版本，必然被拒），真正的判定交给后端，失败时原样展示它给的原因。
 * ---------------------------------------------------------------------- */

const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已上架",
  REJECTED: "未通过",
};

const SUBMISSION_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-700",
  APPROVED: "bg-emerald-500/10 text-emerald-700",
  REJECTED: "bg-destructive/10 text-destructive",
};

function GalaxyContributionSection({ slug }: { slug: string }) {
  const [submissions, setSubmissions] = useState<GalaxyContentSubmission[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  /* null 表示"还没加载过"：打开表单时才拉取，避免每次进内容页都多一个请求。 */
  const [articles, setArticles] = useState<MyArticleSummary[] | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    galaxiesApi
      .listMySubmissions(slug)
      .then((rows) => {
        if (active) setSubmissions(rows);
      })
      .catch(() => {
        /* 推荐记录读失败不阻塞内容浏览：内容区是主任务，这里只是补充信息。 */
      });
    return () => {
      active = false;
    };
  }, [slug]);

  async function openComposer() {
    setFeedback(null);
    setComposerOpen(true);
    if (articles !== null) return;
    try {
      const list = await articlesApi.listMine();
      setArticles(list.filter((item) => item.status !== "DRAFT"));
    } catch {
      setArticles([]);
      setFeedback({ kind: "error", text: "作品列表加载失败，请稍后重试。" });
    }
  }

  async function handleSubmit() {
    if (!selectedArticleId) {
      setFeedback({ kind: "error", text: "请选择要推荐的作品。" });
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      await galaxiesApi.submitContent(slug, {
        objectType: "ARTICLE",
        objectId: selectedArticleId,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setFeedback({ kind: "ok", text: "已提交，等待星系管理员审核。" });
      setComposerOpen(false);
      setSelectedArticleId("");
      setNote("");
      setArticles(null);
      const rows = await galaxiesApi.listMySubmissions(slug);
      setSubmissions(rows);
    } catch (err) {
      setFeedback({
        kind: "error",
        text: err instanceof Error && err.message ? err.message : "提交失败，请稍后重试。",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <PageSection
      id="galaxy-contribute"
      title="推荐我的作品"
      description="作为星系成员，你可以把自己的作品推荐进来；管理员审核通过后会出现在关联内容中。"
    >
      <div className="space-y-3">
        {composerOpen ? (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <label className="block text-sm font-medium" htmlFor="galaxy-contribute-article">
              选择作品
            </label>
            {articles === null ? (
              <p className="text-sm text-muted-foreground">正在加载你的作品…</p>
            ) : articles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                没有可推荐的作品。草稿需要先公开发布才能推荐。
              </p>
            ) : (
              <select
                id="galaxy-contribute-article"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedArticleId}
                onChange={(event) => setSelectedArticleId(event.target.value)}
              >
                <option value="">请选择一篇作品</option>
                {articles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title ?? "未命名作品"}
                  </option>
                ))}
              </select>
            )}

            <label className="block text-sm font-medium" htmlFor="galaxy-contribute-note">
              推荐语（可选）
            </label>
            <Textarea
              id="galaxy-contribute-note"
              value={note}
              maxLength={200}
              rows={2}
              placeholder="一句话说明它为什么适合这个星系"
              onChange={(event) => setNote(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSubmit} disabled={pending || !selectedArticleId}>
                {pending ? "提交中…" : "提交推荐"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setComposerOpen(false);
                  setSelectedArticleId("");
                  setNote("");
                }}
                disabled={pending}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={openComposer}>推荐我的作品</Button>
        )}

        {feedback ? (
          <p
            role="status"
            className={
              feedback.kind === "ok"
                ? "text-sm text-emerald-700"
                : "text-sm text-destructive"
            }
          >
            {feedback.text}
          </p>
        ) : null}

        {submissions.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium">我的推荐</h3>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
              {submissions.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  {/* title 来自活文档：作品下架后为 null，此时不沿用旧标题。 */}
                  <span className={item.title ? "text-sm" : "text-sm text-muted-foreground"}>
                    {item.title ?? "内容不可用"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      SUBMISSION_STATUS_CLASS[item.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {SUBMISSION_STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  {item.status === "REJECTED" && item.rejectReason ? (
                    <span className="text-xs text-muted-foreground">{item.rejectReason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}
