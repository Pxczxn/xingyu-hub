import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { ApiError } from "@/api/client";
import { ArticleContinueReading } from "@/features/article/components/ArticleContinueReading";
import { ArticleInteractions } from "@/features/article/components/ArticleInteractions";
import { ArticleOutline } from "@/features/article/components/ArticleOutline";
import { CommentSection } from "@/features/article/components/CommentSection";
import { ReportLink } from "@/features/moderation/components/ReportLink";
import { ArticleMarkdownBody, extractArticleOutline } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [articleId, reloadKey]);

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
  if (state.kind === "error" || !article) {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <article className="section-gap">
      <header className="flex flex-col gap-4">
        <h1 className="text-display font-semibold tracking-tight text-primary">{article.title}</h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-muted-foreground">
          <Link to={`/u/${article.ownerUsername}`} className="group flex items-center gap-2">
            {article.ownerAvatar ? (
              <img src={article.ownerAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              /*
                2026-10-13 (batch 07c): the 10px on this fallback avatar is deliberate,
                and after this batch it is the ONLY 10px left in the app — every other
                occurrence came up to the 11px floor. It is not a text step: it is the
                first glyph of a 24px disc, i.e. part of a graphic, sitting in a header
                whose name is rendered at `text-meta` right beside it. 10px is already
                the large end for a fallback avatar at a 0.42 glyph-to-disc ratio, and
                the character is decorative — the real name is the link text one line
                over, so nothing here has to be read at a glance.
              */
              <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px]">
                {(article.ownerDisplayName ?? article.ownerUsername).slice(0, 1)}
              </span>
            )}
            <span className="font-medium text-foreground transition-colors group-hover:text-accent-strong">
              {article.ownerDisplayName ?? article.ownerUsername}
            </span>
          </Link>
          {article.publishedAt ? (
            <>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span className="tabular-nums">{formatDate(article.publishedAt)}</span>
            </>
          ) : null}
        </div>

        {/*
          The summary is the article's LEDE, not a panel. It was wrapped in
          `rounded-lg border bg-card p-4` — a card inside the reading column,
          which reads as a separate object the reader may skip, and which adds a
          second border 12px under the title. A lede is the title's continuation:
          no surface, one step down in weight, same left edge as the body below.
        */}
        {article.summary ? (
          <p className="max-w-[var(--reading-measure)] text-meta leading-7 text-muted-foreground">
            {article.summary}
          </p>
        ) : null}

        {/*
          Series context and topic chips share ONE metadata row below the lede.
          They are the same kind of fact — where this article sits — and giving
          each its own full-width line pushed the body 56px further down for two
          facts the reader scans rather than reads. `text-meta` (13px) is the
          weight the priority table asks for: below the title and the author,
          above nothing.
        */}
        {article.seriesContexts.length > 0 || (article.topicSlugs?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-meta">
            {article.seriesContexts.length > 0 ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-muted-foreground">收录于</span>
                {article.seriesContexts.map((series) => (
                  <Link
                    key={series.id}
                    to={`/series/${encodeURIComponent(series.id)}`}
                    className="focus-ring rounded-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                  >
                    {series.title} · 第 {series.position} 章
                  </Link>
                ))}
              </span>
            ) : null}

            {article.topicSlugs && article.topicSlugs.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {article.topicSlugs.map((slug) => (
                  <li key={slug}>
                    <Link
                      to={`/topics/${slug}`}
                      className="focus-ring inline-block rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-accent-line hover:text-accent-strong"
                    >
                      #{slug}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </header>

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
           `max-w-[var(--reading-measure)]` measures 39 glyphs at the 18px body
           (Batch 13; it was 42 at the old 15px body on a 638px column).

        Both are fixed by one grid. `order` moves the outline ABOVE the body
        below `lg` (where a side rail has no room) and beside it at `lg`+ as a
        sticky rail. It is a SINGLE DOM node with CSS ordering rather than two
        copies behind responsive `hidden` — two copies would mean two
        `nav[aria-label="文章目录"]` landmarks, which is both an a11y smell and
        something the tests would have to work around.

        Batch 11 — the first column was `minmax(0, 1fr)`.
        ------------------------------------------------------------
        `1fr` took everything the shell gave it (974.5px at 1440) while the body
        below capped itself at `max-w-[68ch]` (638px). The surplus 336px stayed
        INSIDE the first column, and `lg:gap-10` added 40px more, so the outline
        sat 376.5px from the body at 1440 and 494px at 1920 — measured, not
        estimated. The outline was not beside the text, it was at the far right
        edge of the viewport.

        The column is now sized to the measure (`minmax(0, var(--reading-measure))`)
        so the gap is the gap and nothing else. `justify-start`, not
        `justify-center`: centring the pair would drag the title's left edge off
        the body's, and this app has already learned that lesson once
        (`PageMasthead`: the action cluster pushed to the far right left a 530px
        hole). Left edges stay put; the leftover width becomes page margin,
        which is what it is.

        Batch 13 — why the measure is a variable and not `68ch`.
        ------------------------------------------------------------
        `ch` resolves against the element's OWN font-size, so `68ch` here
        measured 638px on the page's 16px ancestor while the series reader's
        `68ch` measured 717.8px on its 18px column: two surfaces that both said
        "68ch" and disagreed by 79.75px. `--reading-measure` states the width
        once, as an absolute length, so this column and the reader's default
        column are the same 717.785px. The token is documented in tokens.css.
      */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,var(--reading-measure))_220px] lg:items-start lg:justify-start lg:gap-x-12">
        <div className="order-2 min-w-0 lg:order-1">
          {/*
            The cover lives INSIDE the reading column, not above it.

            It used to be a sibling of the grid at `aspect-[16/9] w-full`: on a
            1200px shell that is a 675px-tall band, so a reader who came for the
            text scrolled past three quarters of a screen of image before
            reaching line one. The priority table puts the cover nowhere — the
            article's P0 is the title and the body — so it must not outrank
            them.

            Two changes fix it without deleting the author's artwork: it now
            shares the body's measure (`max-w-[var(--reading-measure)]`, so ~340px tall instead of
            675px) and shares the body's left edge, which makes it read as an
            illustration FOR this text rather than a banner the text sits under.
            The 16:9 ratio is kept as-is — cropping the author's framing to buy
            height would be trading their decision for ours.
          */}
          {article.coverUrl ? (
            <img
              src={article.coverUrl}
              alt=""
              className="mb-8 aspect-[16/9] w-full max-w-[var(--reading-measure)] rounded-lg border border-border object-cover"
            />
          ) : null}

          <div className="max-w-[var(--reading-measure)]">
            <ArticleMarkdownBody body={prepared?.markdown ?? article.body} />

            {prepared?.recoveredFromHtml ? (
              <p className="mt-4 text-meta text-muted-foreground">
                （本文正文来自旧版富文本，已自动转换为 Markdown 渲染）
              </p>
            ) : null}
          </div>
        </div>

        {outline.length > 0 ? <ArticleOutline items={outline} /> : null}
      </div>

      {/*
        The tail shares the body's measure.

        Everything below the body used to span the whole shell (1200px) while
        the body itself is capped at `max-w-[var(--reading-measure)]` (717.8px).
        Two costs: the page widens abruptly the moment the article ends, and
        every comment line then runs ~85 CJK glyphs — more than twice a
        comfortable measure. Holding the tail to the reading column keeps one
        left edge from the title to the last comment. `gap-8` matches
        `section-gap`, so the rhythm is unchanged.
      */}
      <div className="flex max-w-[var(--reading-measure)] flex-col gap-8">
        <ArticleInteractions objectType="ARTICLE" objectId={article.id} />

        {/* Quiet, secondary entry. `owner` comes from the server, so the author
            does not see a report link for their own article. */}
        <ReportLink objectType="ARTICLE" objectId={article.id} hidden={article.owner} />

        <CommentSection objectType="ARTICLE" objectId={article.id} />

        {/* Last, deliberately: a reader reaches this block only after the body
            and the comments, which is the moment they are deciding what to read
            next. See the component for the walkthrough evidence behind it. */}
        <ArticleContinueReading article={article} />
      </div>
    </article>
  );
}
