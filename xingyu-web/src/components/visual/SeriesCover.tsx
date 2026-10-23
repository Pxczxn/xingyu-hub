import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const COVER_TONES = [
  "border-primary/20 bg-primary text-primary-foreground",
  "border-accent/40 bg-muted text-primary",
  "border-border bg-card text-primary",
  "border-primary/15 bg-primary/90 text-primary-foreground",
] as const;

export type SeriesCoverVariant = "thumbnail" | "cover" | "poster" | "jacket";

/**
 * A deterministic decorative book cover. It is presentation, not business data:
 * the tone comes from the series key, never from the title, so renaming a
 * series does not repaint its cover.
 *
 * Four compositions for four jobs:
 *
 *   thumbnail  a wide strip for feed rows (home)
 *   cover      the small portrait cover beside a title (legacy directory/read)
 *   poster     the plaza's work card — a book jacket at 3:4 with a spine, an
 *              inner panel and the imprint line. Sized by the caller through
 *              `className` (the card sets a fixed column width, so height
 *              follows the ratio instead of being hard-coded).
 *   jacket     the work page's reading copy, still 3:4 and still sized by the
 *              caller. It renders its own composition (paper stock, gold spine,
 *              the tilted Saturn ring behind the fore edge, the imprint at the
 *              foot) rather than recolouring `poster`, because the two say
 *              different things: a plaza card is one of many books on a shelf,
 *              this is the copy you are about to open. It therefore ignores
 *              COVER_TONES — a paper stock that changed with the seed would
 *              read as four different paper types. `data-cover-variant` still
 *              reports the seeded tone, so the deterministic identity stays
 *              observable from the DOM.
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

  if (sizeVariant === "jacket") {
    return (
      <span
        aria-hidden
        data-testid="generated-series-cover"
        data-cover-key={stableKey}
        data-cover-variant={toneVariant}
        className={cn(
          "relative block aspect-[3/4] w-full shrink-0 overflow-hidden rounded-[5px_10px_10px_5px]",
          "border border-accent-line/70 bg-gradient-to-br from-muted via-background to-muted",
          /* The drop shadow falls down-right, as a book standing at a slight
             angle would: `-18px` spread pulls it in so it stays a contact
             shadow instead of a floating card. Tinted with --foreground rather
             than black, which over cream goes grey. */
          "shadow-[10px_17px_27px_-18px_hsl(var(--foreground)/0.22),2px_3px_8px_hsl(var(--foreground)/0.06)]",
          className,
        )}
      >
        {/* The bound edge: a gilt spine line, inset from the trim. */}
        <span className="absolute inset-y-0 left-2 w-0.5 bg-gradient-to-b from-accent-line via-accent to-accent-line opacity-70" />
        {/* The printed area inside the board. */}
        <span className="absolute inset-y-[13px] left-5 right-[13px] border border-accent-line/60" />

        {/* The Saturn system sits behind the fore edge, mostly cropped — which
            is what makes it read as printed off the page. */}
        <span className="absolute right-[-72px] top-[23px] h-[72px] w-[168px] rotate-[-40deg] rounded-[50%] border border-accent/70 opacity-75" />
        <span className="absolute right-[-49px] top-[30px] h-[46px] w-[120px] rotate-[-40deg] rounded-[50%] border border-accent/40 opacity-45" />
        <span className="absolute right-[-13px] top-8 h-[54px] w-[54px] rounded-full border border-accent/70" />
        <span className="absolute right-[18px] top-[22px] h-1.5 w-1.5 rounded-full bg-accent" />

        {/* Imprint at the foot: the series mark, then its gold rule. Both are
            measured from the text baseline, so the rule does not drift when
            the cover is scaled down on a phone. */}
        <span className="absolute bottom-[18px] left-[23px] right-3">
          <span className="block text-[10px] font-medium uppercase tracking-[0.29em] text-muted-foreground">
            XINGYU SERIES
          </span>
          <span className="mt-2 block h-0.5 w-[37px] bg-accent" />
        </span>
      </span>
    );
  }

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
