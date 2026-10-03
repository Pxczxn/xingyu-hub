import { Link } from "react-router-dom";
import type { ContentSummary } from "@/api/common.types";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentVisual } from "@/components/visual/ContentVisual";

const TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  SERIES: "系列",
  MOMENT: "动态",
};

function typeLabel(objectType?: string) {
  return objectType ? TYPE_LABELS[objectType.toUpperCase()] : undefined;
}

export function DiscoverFocusItem({
  item,
  variant,
}: {
  item: ContentSummary;
  variant: "primary" | "secondary";
}) {
  const label = typeLabel(item.objectType);
  const primary = variant === "primary";
  const stretches = primary && Boolean(item.cover);

  return (
    <article
      data-testid={`discover-focus-${variant}`}
      className={
        primary
          ? `flex flex-col overflow-hidden rounded-xl border shadow-none ${
              stretches ? "h-full border-border/70 bg-card" : "border-accent/30 bg-accent/5"
            }`
          : "grid h-full min-h-[148px] grid-cols-[128px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border/60 bg-card/80"
      }
    >
      {primary && item.cover ? (
        <img src={item.cover} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
      ) : null}
      {!item.cover && primary ? (
        <ContentVisual
          stableKey={item.id || item.title}
          objectType={item.objectType}
          variant="feature"
          className="h-48 aspect-auto rounded-none border-0 border-b border-accent/20"
        />
      ) : null}
      {!primary ? (
        <ContentVisual
          stableKey={item.id || item.title}
          objectType={item.objectType}
          cover={item.cover}
          variant="compact"
          className="h-full min-h-full w-full aspect-auto rounded-none border-0 border-r border-border/60"
        />
      ) : null}
      <div
        className={
          primary ? `flex flex-col p-4 ${stretches ? "flex-1" : ""}` : "flex min-w-0 flex-col p-4"
        }
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {label ? <span className="rounded-full bg-muted px-2 py-0.5">{label}</span> : null}
          {item.readMinutes ? <span>{item.readMinutes} 分钟阅读</span> : null}
        </div>
        <Link
          to={contentHref(item)}
          className={
            primary
              ? "focus-ring line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight text-primary hover:text-accent"
              : "focus-ring line-clamp-2 text-[15px] font-semibold leading-5 text-primary hover:text-accent"
          }
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p
            className={
              primary
                ? "mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground"
                : "mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground"
            }
          >
            {item.summary}
          </p>
        ) : null}
        {item.authorName ? (
          <p
            className={`truncate text-xs text-muted-foreground ${
              primary ? (stretches ? "mt-auto pt-5" : "mt-3") : "mt-auto pt-3"
            }`}
          >
            {item.authorName}
          </p>
        ) : null}
        {primary ? (
          <Link
            to={contentHref(item)}
            className="mt-3 text-xs font-medium text-accent hover:underline"
          >
            查看内容 →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
