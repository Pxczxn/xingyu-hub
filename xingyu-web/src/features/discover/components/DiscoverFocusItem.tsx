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
          /*
           * A fixed height is wrong for a full-width plate: 192px is a wide BAND in the
           * 682px desktop column (3.55:1) but a near-square BLOCK in the 327px mobile
           * card (1.70:1), where it ate 192 of the 360px between the card's top and the
           * fold and pushed the title to y=721 on an 844px screen.
           *
           * Fixing the PROPORTION instead of the height keeps the plate reading as an
           * accent at both widths: 96px in a 327px card is 3.4:1, i.e. the same band the
           * desktop column shows. Measured effect on 390: the title moves from y=721 to
           * y=625, which brings the summary and byline onto the first screen too.
           *
           * The desktop value is untouched — this only shortens the plate where the
           * column is narrow.
           */
          className="h-24 aspect-auto rounded-none border-0 border-b border-accent/20 sm:h-48"
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
          {/*
           * A `readMinutes` branch used to render here. It could never fire: the field is
           * declared on ContentSummary and read in four places, but nothing produces it —
           * no Java source mentions `readMinutes` / `read_minutes` at all, and the database
           * has no such column. Removed as a dead branch on this page.
           *
           * The other three readers are deliberately left alone: they are outside Discover
           * and the field should be either implemented or deleted in ONE decision, not
           * piecemeal here.
           */}
        </div>
        <Link
          to={contentHref(item)}
          className={
            primary
              ? "focus-ring line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight text-primary hover:text-accent-strong"
              : "focus-ring line-clamp-2 text-[15px] font-semibold leading-5 text-primary hover:text-accent-strong"
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
            className="mt-3 text-xs font-medium text-accent-strong hover:underline"
          >
            查看内容 →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
