import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const COVER_TONES = [
  "border-primary/20 bg-primary text-primary-foreground",
  "border-accent/40 bg-muted text-primary",
  "border-border bg-card text-primary",
  "border-primary/15 bg-primary/90 text-primary-foreground",
] as const;

export type SeriesCoverVariant = "thumbnail" | "cover" | "poster";

/**
 * A deterministic decorative book cover. It is presentation, not business data:
 * the tone comes from the series key, never from the title, so renaming a
 * series does not repaint its cover.
 *
 * Three compositions for three jobs:
 *
 *   thumbnail  a wide strip for feed rows (home)
 *   cover      the small portrait cover beside a title (legacy directory/read)
 *   poster     the plaza's work card — a book jacket at 3:4 with a spine, an
 *              inner panel and the imprint line. Sized by the caller through
 *              `className` (the card sets a fixed column width, so height
 *              follows the ratio instead of being hard-coded).
 *
 * Every variant keeps the same visual vocabulary (spine, orbit, imprint) so a
 * series is recognisable across surfaces, and the same deterministic tone so
 * it is recognisable across visits.
 */
export function SeriesCover({
  stableKey,
  title: _title,
  variant: sizeVariant = "cover",
  className,
}: {
  stableKey: string;
  title: string;
  variant?: SeriesCoverVariant;
  className?: string;
}) {
  const toneVariant = stableVariant(stableKey, COVER_TONES.length);
  const orbitOffset = 7 + stableVariant(`${stableKey}:orbit`, 18);
  const poster = sizeVariant === "poster";
  const thumbnail = sizeVariant === "thumbnail";

  return (
    <span
      aria-hidden
      data-testid="generated-series-cover"
      data-cover-key={stableKey}
      data-cover-variant={toneVariant}
      className={cn(
        "relative block shrink-0 overflow-hidden border",
        thumbnail && "h-20 w-[120px] rounded-md",
        sizeVariant === "cover" && "h-24 w-[72px] rounded-md",
        poster && "aspect-[3/4] w-full rounded-[3px]",
        COVER_TONES[toneVariant],
        className,
      )}
    >
      {/* The spine: every book-shaped cover keeps a bound left edge. */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 border-r border-accent/35 bg-accent/20",
          poster ? "w-2" : "w-1.5",
        )}
      />
      {/* An inner panel reads as the printed area inside the jacket. */}
      {poster ? (
        <span className="absolute inset-y-2.5 left-4 right-2.5 rounded-[2px] border border-accent/15" />
      ) : null}
      <span
        className={cn(
          "absolute rounded-full border border-accent/60",
          poster ? "h-[62px] w-[62px]" : "h-14 w-14",
        )}
        style={{ right: -orbitOffset, top: orbitOffset - 4 }}
      />
      <span
        className={cn(
          "absolute rotate-[-24deg] rounded-[50%] border-t border-accent/70",
          poster ? "h-10 w-[72px]" : "h-9 w-16",
        )}
        style={{ right: -Math.floor(orbitOffset / 2), top: orbitOffset + 12 }}
      />
      <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent" />
      <span
        className={cn(
          "absolute left-3 right-2",
          thumbnail ? "bottom-3" : poster ? "bottom-3.5" : "bottom-4",
        )}
      >
        <span className="block text-[9px] font-medium uppercase tracking-[0.18em] opacity-60">
          XINGYU SERIES
        </span>
        {thumbnail ? null : <span className="mt-1 block h-px w-8 bg-accent/80" />}
      </span>
    </span>
  );
}
