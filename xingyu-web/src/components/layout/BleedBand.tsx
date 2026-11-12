import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * BleedBand — a band that bleeds past the shell's content padding.
 *
 * BELONGS TO: any archetype that takes the R = 出 value (a full-width band on
 * the first screen, then back to the content column). SK2 / SK7 mostly, and
 * "出" is quota-limited to two pages per domain — it only has force while it
 * stays rare.
 * AXIS: R = 出 (edge-to-edge rhythm).
 *
 * HOW THE BLEED WORKS: `.content-shell` insets its children by `px-4`
 * (16px, `md:px-6` = 24px). A negative margin of exactly that amount puts the
 * band's background on the shell's outer edge, which is the widest line the
 * shell owns. It deliberately does NOT reach the viewport edge: on a 90%-wide
 * shell that would need `50% - 50vw` maths and would produce a horizontal
 * scrollbar the moment a scrollbar-gutter is reserved. "Full bleed" here means
 * "wider than every other block on the page", which is what the rhythm needs.
 *
 * Motifs are background layers only (B §6): the band paints the surface, the
 * content sits at `z-10`. Quota: ≤2 motif kinds per page, ≤3 instances of one
 * motif per viewport.
 */
export type BleedBandTone = "canvas" | "card" | "sunken" | "tint";
export type BleedBandMotif = "orbit" | "mesh" | "grain";

export type BleedBandProps = {
  children: ReactNode;
  /**
   * Surface. `tint` is a neutral fallback — a domain band should override it
   * with `bg-tint-<domain>` in `className`.
   */
  tone?: BleedBandTone;
  /** B §6 motif. `mesh` paints its own base, so it wins over `tone`. */
  motif?: BleedBandMotif;
  /** Id of the band's own heading, when it has one. Omit for a plain band. */
  labelledBy?: string;
  className?: string;
  /** Padding for the inner content (the band itself owns only the bleed). */
  contentClassName?: string;
};

const TONE: Record<BleedBandTone, string> = {
  canvas: "bg-background",
  card: "bg-card",
  sunken: "bg-surface-sunken",
  tint: "bg-tint-topics",
};

const MOTIF: Record<BleedBandMotif, string> = {
  orbit: "motif-orbit",
  mesh: "motif-mesh",
  grain: "motif-grain",
};

export function BleedBand({
  children,
  tone = "canvas",
  motif,
  labelledBy,
  className,
  contentClassName,
}: BleedBandProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "-mx-4 border-y border-border/70 md:-mx-6",
        motif === "mesh" ? undefined : TONE[tone],
        motif ? MOTIF[motif] : undefined,
        className,
      )}
    >
      <div className={cn("relative z-10 px-4 py-10 md:px-6 md:py-12", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
