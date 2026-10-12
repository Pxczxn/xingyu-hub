import { Link } from "react-router-dom";
import type { ContentSummary } from "@/api/common.types";
import { contentHref } from "@/components/shared/ContentCard";

const TYPE_LABELS: Record<string, string> = { ARTICLE: "文章", SERIES: "系列", MOMENT: "动态" };

/*
 * One row of a topic's content list.
 *
 * NO TIMESTAMP IS RENDERED. `updatedAt` on this rail is
 * `ExplorationService` → `document.getIndexedAt()` — the moment the search-index row was
 * last written. It moves on an operator rebuild and on unrelated writes, so it is neither
 * a publication time nor a content-update time; 「27 天前」 would assert a fact the data
 * does not carry. It returns only when the index can carry a real content time.
 *
 * Dropping it also removes this row's ONLY separator. The meta line used to read
 * `author · 27 天前 [文章]`, and that 「·」 was written between two hardcoded slots — so it
 * would have been left dangling in front of the type chip whenever the author was
 * missing, which the payload allows. Nothing needs separating now.
 *
 * The container is conditional too: an item with no author, no avatar and no type renders
 * no empty meta line, and the title then loses its `mt-2` rather than leaving a stray gap.
 */
export function TopicContentItem({ item }: { item: ContentSummary }) {
  const typeLabel = item.objectType ? TYPE_LABELS[item.objectType.toUpperCase()] : undefined;
  const authorInitial = (item.authorName ?? "").trim().charAt(0).toUpperCase();
  const hasMeta = Boolean(item.avatar || item.authorName || typeLabel);

  return (
    <article className="flex gap-4 border-b border-border/50 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        {hasMeta ? (
          <div
            data-testid="topic-item-meta"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {item.avatar ? (
              <img src={item.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : item.authorName ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px]">
                {authorInitial}
              </span>
            ) : null}
            {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
            {typeLabel ? (
              <span className="rounded-md bg-muted px-2 py-0.5">{typeLabel}</span>
            ) : null}
          </div>
        ) : null}
        <Link
          to={contentHref(item)}
          className={`focus-ring block text-[17px] font-semibold leading-6 text-primary hover:text-accent-strong ${
            hasMeta ? "mt-2" : ""
          }`}
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
      </div>
      {item.cover ? (
        <img
          src={item.cover}
          alt=""
          className="h-24 w-40 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      ) : null}
    </article>
  );
}
