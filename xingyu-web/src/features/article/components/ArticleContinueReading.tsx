import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { ContentSummary } from "@/api/common.types";
import { seriesApi } from "@/api/series/series.api";
import { topicsApi } from "@/api/topics/topics.api";
import { FeedRow } from "@/components/layout";
import { contentHref } from "@/components/shared/ContentCard";

/*
 * 「继续阅读」— the exit at the bottom of an article.
 *
 * EVIDENCE (guest walkthrough, 2026-10-22). The detail page is where the home
 * feed, search results and the topic lists send a reader, and it used to END
 * there: on a 1440×900 viewport the whole document was 900px tall, the article
 * contained ZERO links to another article or chapter, and the only exits were
 * the author page, the series context and two login links. A first-time visitor
 * who opened one article had no next step except the browser's back button.
 *
 * Both exits below reuse endpoints that already exist and are already public —
 * no new backend capability, no new payload field:
 *
 *   1. In a series  → previous / next chapter. `GET /api/v1/series/{id}` already
 *      returns `chapters` with `articleId` + `position`, which is everything
 *      needed to compute the neighbours. The links open the series reader
 *      (`/series/:id/read?chapter=…`) rather than the standalone article page,
 *      matching how the series page itself links chapters, so the reader stays
 *      inside the work.
 *   2. Not in a series → other public articles from the article's first topic
 *      (`GET /api/v1/topics/{slug}/content`), rendered with the same row
 *      component the topic page uses.
 *
 * FAILURE IS SILENT. Extended reading is an addition to a page that already
 * succeeded; a 401, a deleted topic or an offline request must not replace the
 * end of a readable article with an error box. The block simply renders what it
 * managed to load.
 *
 * When both lookups come back empty the block still renders one honest door
 * (「去探索更多内容」) instead of leaving the page without an exit — that is the
 * case this component exists to fix.
 */

type ChapterLink = { articleId: string; title: string | null; position: number };

type SeriesNav = {
  id: string;
  title: string;
  prev: ChapterLink | null;
  next: ChapterLink | null;
};

type ContinueState = {
  series: SeriesNav | null;
  related: ContentSummary[];
};

const RELATED_LIMIT = 2;

function chapterLabel(chapter: ChapterLink): string {
  return chapter.title?.trim() || `第 ${chapter.position} 章`;
}

export function ArticleContinueReading({ article }: { article: ArticleDetail }) {
  const seriesContext = article.seriesContexts?.[0] ?? null;
  const topicSlug = article.topicSlugs?.[0] ?? null;
  /* `null` = still resolving. The block renders nothing while it decides, so a
     slow lookup cannot flash a "nothing here" door and then replace it. */
  const [state, setState] = useState<ContinueState | null>(null);

  useEffect(() => {
    if (!seriesContext && !topicSlug) {
      setState({ series: null, related: [] });
      return;
    }
    let active = true;
    setState(null);

    const loadSeries = async (): Promise<SeriesNav | null> => {
      if (!seriesContext) return null;
      try {
        const detail = await seriesApi.getPublicById(seriesContext.id);
        const chapters = [...(detail.chapters ?? [])].sort((a, b) => a.position - b.position);
        const index = chapters.findIndex((chapter) => chapter.articleId === article.id);
        /* `-1` means this article is no longer a chapter of that series (removed
           after the article was loaded). Offering neighbours then would link to
           a position the reader does not occupy. */
        if (index < 0) return null;
        return {
          id: detail.id,
          title: detail.title,
          prev: index > 0 ? chapters[index - 1] : null,
          next: index < chapters.length - 1 ? chapters[index + 1] : null,
        };
      } catch {
        return null;
      }
    };

    const loadRelated = async (): Promise<ContentSummary[]> => {
      if (!topicSlug) return [];
      try {
        const items = await topicsApi.getTopicContent(topicSlug, "latest", 6);
        return items
          .filter((item) => item.id !== article.id)
          .filter((item) => (item.objectType ?? "").toUpperCase() === "ARTICLE");
      } catch {
        return [];
      }
    };

    void Promise.all([loadSeries(), loadRelated()]).then(([series, related]) => {
      if (!active) return;
      /* A sibling chapter is usually ALSO the newest article of the same topic
         (verified live: 「后端工程入门」第 1 章 offered 第 2 章 as both 「下一章」
         and the first topic row). One destination, two labels is noise, so the
         chapter wins and the topic list drops it — then trims to the limit. */
      const chapterIds = new Set(
        [series?.prev?.articleId, series?.next?.articleId].filter((id): id is string =>
          Boolean(id),
        ),
      );
      setState({
        series,
        related: related.filter((item) => !chapterIds.has(item.id)).slice(0, RELATED_LIMIT),
      });
    });

    return () => {
      active = false;
    };
  }, [article.id, seriesContext, topicSlug]);

  if (!state) return null;

  const series = state.series;
  const hasSeriesNav = Boolean(series && (series.prev || series.next));
  const hasRelated = state.related.length > 0;

  return (
    <section aria-labelledby="article-continue-heading" className="flex flex-col gap-4">
      <h2 id="article-continue-heading" className="eyebrow">
        继续阅读
      </h2>

      {/*
        Row rhythm, not a card wall (2026-11-10 user correction: 「继续阅读」
        要跟全站 SK6 一致). `FeedRow` is the shared SK6 row: hairline
        separators, no per-item surface, the whole row is the link target.
      */}
      {hasSeriesNav && series ? (
        <div>
          <p className="text-meta text-muted-foreground">
            本系列
            <Link
              to={`/series/${encodeURIComponent(series.id)}`}
              className="focus-ring ml-1.5 rounded-sm font-medium text-foreground transition-colors hover:text-accent-strong"
            >
              {series.title}
            </Link>
          </p>
          <ul className="mt-2 list-none p-0">
            {series.prev ? (
              <FeedRow meta={<span className="text-[11px] text-muted-foreground">上一章</span>}>
                <Link
                  to={`/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(series.prev.articleId)}`}
                  className="focus-ring line-clamp-2 rounded-sm text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                >
                  {chapterLabel(series.prev)}
                </Link>
              </FeedRow>
            ) : null}
            {series.next ? (
              <FeedRow meta={<span className="text-[11px] text-muted-foreground">下一章</span>}>
                <Link
                  to={`/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(series.next.articleId)}`}
                  className="focus-ring line-clamp-2 rounded-sm text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                >
                  {chapterLabel(series.next)}
                </Link>
              </FeedRow>
            ) : null}
          </ul>
        </div>
      ) : null}

      {hasRelated ? (
        <ul className="list-none p-0">
          {state.related.map((item) => (
            <FeedRow key={item.id}>
              <Link
                to={contentHref(item)}
                className="focus-ring block rounded-sm text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
              >
                {item.title}
              </Link>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-meta leading-5 text-muted-foreground">
                  {item.summary}
                </p>
              ) : null}
            </FeedRow>
          ))}
        </ul>
      ) : null}

      {!hasSeriesNav && !hasRelated ? (
        <p className="text-meta text-muted-foreground">
          这篇之后，
          <Link
            to="/discover"
            className="focus-ring rounded-sm font-medium text-accent-strong hover:underline"
          >
            去探索更多内容
          </Link>
        </p>
      ) : null}
    </section>
  );
}
