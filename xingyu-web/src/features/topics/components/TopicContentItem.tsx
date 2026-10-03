import { Link } from "react-router-dom";
import type { ContentSummary } from "@/api/common.types";
import { contentHref } from "@/components/shared/ContentCard";
import { formatRelativeTime } from "@/lib/relative-time";

const TYPE_LABELS: Record<string, string> = { ARTICLE: "文章", SERIES: "系列", MOMENT: "动态" };

export function TopicContentItem({ item }: { item: ContentSummary }) {
  const typeLabel = item.objectType ? TYPE_LABELS[item.objectType.toUpperCase()] : undefined;
  const updatedAt = formatRelativeTime(item.updatedAt);
  const authorInitial = (item.authorName ?? "").trim().charAt(0).toUpperCase();

  return (
    <article className="flex gap-4 border-b border-border/50 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.avatar ? (
            <img src={item.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : item.authorName ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px]">
              {authorInitial}
            </span>
          ) : null}
          {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
          {updatedAt ? <span>· {updatedAt}</span> : null}
          {typeLabel ? <span className="rounded-md bg-muted px-2 py-0.5">{typeLabel}</span> : null}
        </div>
        <Link
          to={contentHref(item)}
          className="focus-ring mt-2 block text-[17px] font-semibold leading-6 text-primary hover:text-accent"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
        {item.readMinutes ? (
          <p className="mt-2 text-xs text-muted-foreground">{item.readMinutes} 分钟阅读</p>
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
