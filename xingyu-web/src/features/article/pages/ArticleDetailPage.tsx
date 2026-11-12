import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
import {
  READER_DEFAULT_FONT_SIZE,
  READER_DEFAULT_LINE_HEIGHT,
  READER_FONT_SIZES,
  READER_LINE_HEIGHT_STEPS,
  ReaderDocInfo,
  ReaderFrame,
  ReaderProgress,
  ReaderSettingsButton,
  ReaderSourceCard,
  ReaderTools,
  readerDocumentStats,
} from "@/components/layout";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/*
 * Article-reading page — real implementation.
 * Real endpoint: GET /api/v1/articles/{articleId}.
 *
 * The body is rendered with the migrated Legacy Markdown READING pipeline
 * (unified/remark/rehype). Legacy HTML-polluted bodies are recovered via
 * turndown before rendering — the DB already contains such content.
 *
 * (Naming note, 2026-11-10: all content-reading surfaces — 文章 / 指南 / 公告 /
 * 规则 / 系列章节 — are the same 「内容阅读页」 template. "阅读器" in older docs
 * names the SK7 immersive prototype, not this route.)
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

/*
 * Body typography overrides (user correction, 2026-11-10 point 5).
 *
 * The long-form defaults live in `globals.css` (`18px / 1.85`, h2 24px) and that
 * file is not this task's to edit, so the reading-page refinements are applied
 * through descendant variants on the body wrapper. The two values the reader
 * controls are CSS variables: `--reading-body-size` is the token `.article-body`
 * itself already reads (so font size needs no specificity fight), and
 * `--reader-line-height` is read by the two line-height rules below.
 *
 * Specificity: `.wrapper .article-body > * + *` (0,2,1) beats globals'
 * `.article-body > * + *` (0,1,1); same for the paragraph line-height and the
 * h2 overrides.
 */
const BODY_TYPOGRAPHY = cn(
  "[&_.article-body]:leading-[var(--reader-line-height)]",
  "[&_.article-body_p]:leading-[var(--reader-line-height)]",
  /* Paragraph rhythm: 1.15em (~20px at the 18px body), per the user correction. */
  "[&_.article-body>*+*]:mt-[1.15em]",
  /* h2: 28px at the default 18px body (1.5556em keeps it proportional), 上 48 下 16. */
  "[&_.article-body_h2]:mt-12",
  "[&_.article-body_h2]:mb-4",
  "[&_.article-body_h2]:text-[1.5556em]",
  "[&_.article-body_blockquote]:border-l-[3px]",
  /* Lists: 8px between items, 1.5em indent. */
  "[&_.article-body_ol]:gap-2",
  "[&_.article-body_ul]:gap-2",
  "[&_.article-body_ol]:pl-[1.5em]",
  "[&_.article-body_ul]:pl-[1.5em]",
);

export function ArticleDetailPage() {
  const { articleId = "" } = useParams<{ articleId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  /* Local reading settings (no persistence, no request): the article body is
     fixed at 18px / 1.9 by default, and these two ladders are the reader's
     override. They live here, not in a store, because only this page reads
     them. */
  const [fontSize, setFontSize] = useState(READER_DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(READER_DEFAULT_LINE_HEIGHT);

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
  /* Real numbers from the rendered body — no API field is invented. Used both
     by the header's "约 N 字" and by the right-track "本文信息" block. */
  const stats = useMemo(
    () => (prepared ? readerDocumentStats(prepared.markdown) : { paragraphs: 0, characters: 0 }),
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

  const bodyStyle = {
    "--reading-body-size": `${fontSize}px`,
    "--reader-line-height": String(lineHeight),
  } as CSSProperties;

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /*
   * 内容阅读页（文章）· SK1 阅读栏（`C-reader.md` §1/§2/§3 + 2026-11-10 用户修正）。
   *
   *   骨架    `ReaderFrame` 三轨：`[元信息 | 正文 | 工具/目录/进度]`。1910 下
   *           正文列仍是 596.1–1313.9，page margin 235（≤240）；两侧 297 栏 +
   *           64 栏距吃掉原本的空白。1024–1439 与 <1024 左右栏不渲染。
   *   纸面    正文列包一层 `rounded-card border bg-card`，内边距 48×56
   *           （<1024 收到 24）—— 白底白卡靠 1px 边 + 留白区分，这是「不再
   *           裸浮」的直接原因。
   *   左栏    作者卡（avatar 40 / 名 / @handle）、发布日期、收录于、标签 chips；
   *           全部来自本页已有字段，没有系列/标签就整块不渲染。
   *   右栏    块序固定 工具 → 目录/本文信息 → 进度：
   *             · 工具：A−/A+ 字号（16/18/20）+ 行距 3 档，真实作用于正文；
   *             · 有 h2/h3 时是目录；没有时换成「本文共 N 段 · 约 M 字」（从
   *               渲染出的 Markdown 实算，不编字段）；
   *             · 进度：4px 轨道 + 整数百分比，滚动实现与顶部 2px 细线共用
   *               同一个 passive scroll + rAF 注册表（全站只有一份实现）。
   *   标题    eyebrow → h1 44/700/1.15 → 摘要 18/`--foreground-soft` → meta 行
   *           （作者 · 日期 · 约 N 字）→ 1px 发丝线 → 48px → 正文。
   *   移动端  左右栏折叠成标题下的 meta 行；右上角 44×44 工具按钮打开底部 Sheet。
   *
   * 行为未变：api、加载/404/错误三态、重试、Markdown 阅读管线、目录抽取、评论与
   * 继续阅读的数据逻辑全部原样保留；只改呈现层与两份本地阅读设置。
   */
  return (
    <article>
      <ReaderFrame
        asideLeftLabel="关于这份内容"
        asideLeft={
          <div className="flex flex-col gap-6 text-meta">
            <ReaderSourceCard
              name={article.ownerDisplayName ?? article.ownerUsername}
              handle={article.ownerUsername}
              avatarUrl={article.ownerAvatar}
              href={`/u/${article.ownerUsername}`}
              rows={[
                ...(article.publishedAt
                  ? [
                      {
                        label: "发布",
                        value: (
                          <time dateTime={article.publishedAt}>
                            {formatDate(article.publishedAt)}
                          </time>
                        ),
                      },
                    ]
                  : []),
                { label: "字数", value: `约 ${stats.characters} 字` },
                { label: "段落", value: `${stats.paragraphs} 段` },
              ]}
            />

            {article.seriesContexts.length > 0 ? (
              <div>
                <p className="eyebrow mb-3">收录于</p>
                <ul className="flex list-none flex-col gap-2 p-0">
                  {article.seriesContexts.map((series) => (
                    <li key={series.id}>
                      <Link
                        to={`/series/${encodeURIComponent(series.id)}`}
                        className="focus-ring block rounded-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                      >
                        {series.title} · 第 {series.position} 章
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {article.topicSlugs && article.topicSlugs.length > 0 ? (
              <div>
                <p className="eyebrow mb-3">标签</p>
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
              </div>
            ) : null}
          </div>
        }
        asideRightLabel="阅读工具与本文信息"
        asideRight={
          <div className="flex flex-col gap-6">
            <ReaderTools
              fontSize={fontSize}
              fontSizeSteps={READER_FONT_SIZES}
              onFontSize={setFontSize}
              lineHeight={lineHeight}
              lineHeightSteps={READER_LINE_HEIGHT_STEPS}
              onLineHeight={setLineHeight}
            />
            {outline.length > 0 ? (
              <ArticleOutline items={outline} rail />
            ) : (
              <ReaderDocInfo body={prepared?.markdown ?? article.body} />
            )}
            <ReaderProgress />
          </div>
        }
      >
        <div className="rounded-card border border-border bg-card p-6 min-[1024px]:px-14 min-[1024px]:py-12">
          <header>
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow">文章</p>
              {/* <1024：44×44 阅读设置按钮在标题区右上角。 */}
              <ReaderSettingsButton
                fontSize={fontSize}
                onFontSize={setFontSize}
                lineHeight={lineHeight}
                onLineHeight={setLineHeight}
                className="min-[1024px]:hidden"
              />
            </div>
            <h1 className="mt-3 text-[44px] font-bold leading-[1.15] tracking-tight text-primary">
              {article.title}
            </h1>
            {article.summary ? (
              <p className="mt-5 text-[18px] leading-[1.7] text-foreground-soft">
                {article.summary}
              </p>
            ) : null}
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
              <span className="font-medium text-foreground-soft">
                {article.ownerDisplayName ?? article.ownerUsername}
              </span>
              {article.publishedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={article.publishedAt} className="tabular-nums">
                    {formatDate(article.publishedAt)}
                  </time>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="tabular-nums">约 {stats.characters} 字</span>
            </p>
            {/* C-reader §3: 标题块最后一条是 1px 发丝线，宽度 = 正文列。 */}
            <div aria-hidden className="mt-6 border-b border-border" />
          </header>

          {article.coverUrl ? (
            <img
              src={article.coverUrl}
              alt=""
              className="mt-8 aspect-[16/9] w-full rounded-card border border-border object-cover"
            />
          ) : null}

          <div
            className={cn("mt-12 max-w-[var(--reading-measure)]", BODY_TYPOGRAPHY)}
            style={bodyStyle}
          >
            <ArticleMarkdownBody body={prepared?.markdown ?? article.body} />

            {prepared?.recoveredFromHtml ? (
              <p className="mt-4 text-meta text-muted-foreground">
                （本文正文来自旧版富文本，已自动转换为 Markdown 渲染）
              </p>
            ) : null}
          </div>

          <footer className="mt-12 flex max-w-[var(--reading-measure)] flex-col gap-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <ArticleInteractions objectType="ARTICLE" objectId={article.id} />
              <button
                type="button"
                onClick={handleBackToTop}
                className="focus-ring ml-auto shrink-0 rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
              >
                返回顶部
              </button>
            </div>

            <div className="border-t border-border pt-8">
              <CommentSection objectType="ARTICLE" objectId={article.id} />
            </div>

            {/* Quiet, secondary entry. `owner` comes from the server, so the author
                does not see a report link for their own article. */}
            <ReportLink objectType="ARTICLE" objectId={article.id} hidden={article.owner} />

            <div className="border-t border-border pt-8">
              {/* Last, deliberately: a reader reaches this block only after the
                  body and the comments, which is the moment they are deciding
                  what to read next. */}
              <ArticleContinueReading article={article} />
            </div>
          </footer>
        </div>
      </ReaderFrame>

      {/*
        1024–1439: the frame renders no rails in this band, so the same trigger
        is pinned to the reading column's top-right corner: `383` = 717.785/2
        (half the measure) + 24 (the design's binding distance), pure CSS — the
        component never measures the DOM (C-reader §4).
      */}
      <div className="fixed left-[calc(50%+383px)] top-[calc(var(--shell-header-height)+16px)] z-rail hidden min-[1024px]:grid min-[1440px]:hidden">
        <ReaderSettingsButton
          fontSize={fontSize}
          onFontSize={setFontSize}
          lineHeight={lineHeight}
          onLineHeight={setLineHeight}
        />
      </div>
    </article>
  );
}
