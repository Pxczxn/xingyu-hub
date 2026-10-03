import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { ApiError } from "@/api/client";
import { ArticleInteractions } from "@/features/article/components/ArticleInteractions";
import { CommentSection } from "@/features/article/components/CommentSection";
import { ArticleMarkdownBody, extractArticleOutline } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { PageState } from "@/components/shared/PageState";

/*
 * Article detail (Phase 1B) — real implementation.
 * Real endpoint: GET /api/v1/articles/{articleId}.
 *
 * The body is rendered with the migrated Legacy Markdown READING pipeline
 * (unified/remark/rehype). Legacy HTML-polluted bodies are recovered via
 * turndown before rendering — the DB already contains such content.
 */
type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; article: ArticleDetail };

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export function ArticleDetailPage() {
  const { articleId = "" } = useParams<{ articleId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!articleId) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    articlesApi
      .getArticle(articleId)
      .then((article) => {
        if (active) setState({ kind: "ready", article });
      })
      .catch((err) => {
        if (!active) return;
        const status = err instanceof ApiError ? err.problem.status : 0;
        setState({ kind: status === 404 ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  const article = state.kind === "ready" ? state.article : null;

  const prepared = useMemo(
    () => (article ? prepareArticleBodyForRead(article.body) : null),
    [article],
  );
  const outline = useMemo(
    () => (prepared ? extractArticleOutline(prepared.markdown) : []),
    [prepared],
  );

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "notfound") {
    return (
      <PageState
        kind="empty"
        title="文章不存在或未公开"
        description="它可能已被删除，或你没有查看权限。"
      />
    );
  }
  if (state.kind === "error" || !article) return <PageState kind="error" />;

  return (
    <article className="section-gap">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold leading-snug text-primary">{article.title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Link
            to={`/u/${article.ownerUsername}`}
            className="flex items-center gap-2 hover:text-accent"
          >
            {article.ownerAvatar ? (
              <img src={article.ownerAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs">
                {(article.ownerDisplayName ?? article.ownerUsername).slice(0, 1)}
              </span>
            )}
            <span className="font-medium text-foreground">
              {article.ownerDisplayName ?? article.ownerUsername}
            </span>
          </Link>
          {article.publishedAt ? <span>{formatDate(article.publishedAt)}</span> : null}
        </div>

        {article.summary ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            {article.summary}
          </p>
        ) : null}

        {article.topicSlugs && article.topicSlugs.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {article.topicSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  to={`/topics/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-accent"
                >
                  #{slug}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {article.coverUrl ? (
        <img
          src={article.coverUrl}
          alt=""
          className="aspect-[16/9] w-full rounded-lg border border-border object-cover"
        />
      ) : null}

      {/*
        Reading layout.
        ============================================================
        Two things were wrong here:

        1. The outline was rendered AFTER the article body. A table of contents
           placed below the thing it indexes cannot be used to navigate it — by
           the time the reader can see it, they have already scrolled past every
           heading it lists.

        2. The body had no reading measure, so on a 1200px shell a Chinese line
           ran ~70 glyphs. Comfortable long-form reading is 30-40 CJK glyphs;
           `max-w-[68ch]` is about 34.

        Both are fixed by one grid. `order` moves the outline ABOVE the body
        below `lg` (where a side rail has no room) and beside it at `lg`+ as a
        sticky rail. It is a SINGLE DOM node with CSS ordering rather than two
        copies behind responsive `hidden` — two copies would mean two
        `nav[aria-label="文章目录"]` landmarks, which is both an a11y smell and
        something the tests would have to work around.
      */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-10">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="max-w-[68ch]">
            <ArticleMarkdownBody body={prepared?.markdown ?? article.body} />

            {prepared?.recoveredFromHtml ? (
              <p className="mt-4 text-meta text-muted-foreground">
                （本文正文来自旧版富文本，已自动转换为 Markdown 渲染）
              </p>
            ) : null}
          </div>
        </div>

        {outline.length > 0 ? (
          <nav
            aria-label="文章目录"
            className="order-1 rounded-xl border border-border/70 bg-card p-4 lg:order-2 lg:sticky lg:top-24"
          >
            <p className="eyebrow mb-3">目录</p>
            <ul className="flex list-none flex-col gap-1.5 p-0">
              {outline.map((item) => (
                <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                  <a
                    href={`#${item.id}`}
                    className="focus-ring block rounded-sm text-meta leading-5 text-muted-foreground transition-colors hover:text-accent-strong"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      <ArticleInteractions objectType="ARTICLE" objectId={article.id} />

      <CommentSection objectType="ARTICLE" objectId={article.id} />
    </article>
  );
}
