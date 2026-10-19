import type { SeriesStatus } from "@/api/series/series.types";
import { cn } from "@/lib/cn";
import { seriesStatusLabel, type ArticleDisplayState } from "../series-labels";

/*
 * Two compact status marks for the creator workbench.
 *
 * The series badge deliberately does not reuse the plaza's decorative card
 * chrome: this is an editorial fact ("公开中" / "已归档"), so it is one small
 * pill that never competes with the title or the primary action.
 */
export function SeriesStatusBadge({
  status,
  className,
}: {
  status: SeriesStatus;
  className?: string;
}) {
  const active = status === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-accent-line bg-accent-soft text-accent-strong"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {seriesStatusLabel(status)}
    </span>
  );
}

const TONE_CLASSES: Record<ArticleDisplayState["tone"], string> = {
  published: "border-accent-line bg-accent-soft text-accent-strong",
  pending: "border-border bg-secondary text-foreground",
  draft: "border-border bg-muted text-muted-foreground",
  blocked: "border-destructive/30 bg-destructive/5 text-destructive",
  unavailable: "border-destructive/30 bg-destructive/5 text-destructive",
};

export function ArticleStateBadge({
  state,
  className,
}: {
  state: ArticleDisplayState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-4",
        TONE_CLASSES[state.tone],
        className,
      )}
    >
      {state.label}
    </span>
  );
}
