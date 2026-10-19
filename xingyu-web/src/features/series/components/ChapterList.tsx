import type { SeriesChapterRelation } from "@/api/series/series.types";
import { cn } from "@/lib/cn";

/*
 * One chapter list, two homes: the desktop sticky sidebar and the mobile
 * chapter drawer. Keeping the markup in one component is what prevents the two
 * navigations from drifting apart (different highlight rules, different labels,
 * different accessible names).
 *
 * The ordinal is `aria-hidden` because the title already says "第一章"; the
 * accessible name of each button stays the chapter title, and the selected state
 * rides on `aria-current` instead of being folded into the name.
 */
export function ChapterList({
  chapters,
  currentIndex,
  currentTitle,
  onSelect,
  className,
  testId,
  dense = false,
}: {
  chapters: SeriesChapterRelation[];
  currentIndex: number;
  /** The loaded article title for the selected chapter, when it differs. */
  currentTitle?: string | null;
  onSelect: (index: number) => void;
  className?: string;
  testId?: string;
  /** Desktop rail: one step tighter than the touch-first drawer. */
  dense?: boolean;
}) {
  return (
    <ol className={cn("flex flex-col gap-0.5", className)} data-testid={testId}>
      {chapters.map((chapter, index) => {
        const isCurrent = index === currentIndex;
        return (
          <li key={chapter.id}>
            <button
              type="button"
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => onSelect(index)}
              className={cn(
                "focus-ring relative flex w-full items-center gap-2 rounded-md pl-4 pr-3 text-left text-sm transition-colors",
                dense ? "py-2" : "py-3",
                isCurrent
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {isCurrent ? (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-1.5 w-0.5 rounded-full bg-accent"
                />
              ) : null}
              <span
                aria-hidden
                className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {/* Prefer the loaded article title, then the chapter title from the
                  series contract, with a positional fallback. */}
              <span className="min-w-0 flex-1 truncate">
                {isCurrent && currentTitle
                  ? currentTitle
                  : chapter.title?.trim() || `第 ${chapter.position} 章`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
