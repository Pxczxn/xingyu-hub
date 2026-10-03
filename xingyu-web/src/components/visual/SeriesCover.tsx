import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const COVER_TONES = [
  "border-primary/20 bg-primary text-primary-foreground",
  "border-accent/40 bg-muted text-primary",
  "border-border bg-card text-primary",
  "border-primary/15 bg-primary/90 text-primary-foreground",
] as const;

export type SeriesCoverVariant = "thumbnail" | "cover";

/** A deterministic decorative book cover. It is presentation, not business data. */
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

  return (
    <span
      aria-hidden
      data-testid="generated-series-cover"
      data-cover-key={stableKey}
      data-cover-variant={toneVariant}
      className={cn(
        sizeVariant === "thumbnail"
          ? "relative block h-20 w-[120px] shrink-0 overflow-hidden rounded-md border"
          : "relative block h-28 w-[84px] shrink-0 overflow-hidden rounded-md border",
        COVER_TONES[toneVariant],
        className,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 border-r border-accent/35 bg-accent/20" />
      <span
        className="absolute h-14 w-14 rounded-full border border-accent/60"
        style={{ right: -orbitOffset, top: orbitOffset - 4 }}
      />
      <span
        className="absolute h-9 w-16 rotate-[-24deg] rounded-[50%] border-t border-accent/70"
        style={{ right: -Math.floor(orbitOffset / 2), top: orbitOffset + 12 }}
      />
      <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent" />
      <span
        className={cn(
          "absolute left-3 right-2",
          sizeVariant === "thumbnail" ? "bottom-3" : "bottom-4",
        )}
      >
        <span className="block text-[9px] font-medium uppercase tracking-[0.18em] opacity-60">
          XINGYU SERIES
        </span>
        {sizeVariant === "cover" ? <span className="mt-1 block h-px w-8 bg-accent/80" /> : null}
      </span>
    </span>
  );
}
