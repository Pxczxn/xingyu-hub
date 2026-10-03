import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { cn } from "@/lib/cn";
import { galaxyKindLabel } from "../galaxy-labels";

export type GalaxyTileVariant = "mine" | "official" | "community";

function memberLabel(memberCount: number): string {
  return memberCount > 0 ? `${memberCount} 位成员` : "暂无成员";
}

/*
 * Galaxy card.
 *
 * 2026-10-03 (layout pass) — the featured tile was broken below 640px.
 *
 * The row was `flex items-center gap-4` with a FIXED 224x112 (`w-56 h-28`)
 * visual that carried `shrink-0`. On a 390px viewport the shell leaves ~320px of
 * content width, so the visual plus the trailing arrow consumed all but ~50px of
 * the row and every character of the title wrapped onto its own line — the card
 * rendered as a column of single glyphs and grew to roughly 300px tall.
 *
 * Fixes:
 *   - the featured tile stacks (`flex-col` → `sm:flex-row`) and its visual is a
 *     full-width banner below `sm`, a 176x112 thumbnail above it;
 *   - the trailing arrow is hidden on the stacked layout, where the explicit
 *     「进入星系」 call to action already carries the affordance;
 *   - `min-w-0` stays on the text column so long names still ellipsize.
 *
 * Hierarchy: the title owns the strongest weight in the card, the meta line is
 * the only muted text, and the CTA is the single gold element — it used to be
 * plain gold text (2.01:1 on cream), now --accent-strong.
 */
export function GalaxyTile({
  galaxy,
  variant = "community",
  featured = false,
}: {
  galaxy: GalaxySummary;
  variant?: GalaxyTileVariant;
  featured?: boolean;
}) {
  const kind = galaxyKindLabel(galaxy.official);

  return (
    <Link
      to={`/galaxies/${encodeURIComponent(galaxy.slug)}`}
      className={cn(
        "group focus-ring flex rounded-xl border transition-[border-color,background-color]",
        featured
          ? "flex-col gap-4 p-4 hover:border-accent-line sm:flex-row sm:items-center sm:gap-5 sm:p-5"
          : "items-center gap-3.5 p-3.5 hover:border-accent-line sm:gap-4 sm:p-4",
        variant === "mine" && "border-accent-line/60 bg-accent-soft/50 hover:bg-accent-soft",
        variant === "official" && "border-border/70 bg-card",
        variant === "community" && "border-border/60 bg-card/70 hover:bg-card",
      )}
    >
      <GalaxyVisual
        stableKey={galaxy.slug}
        official={galaxy.official}
        variant={featured ? "official" : "compact"}
        className={featured ? "h-24 w-full sm:h-28 sm:w-44" : "h-14 w-14 sm:h-16 sm:w-16"}
      />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "block truncate font-semibold text-primary transition-colors group-hover:text-accent-strong",
            featured ? "text-[17px]" : "text-card",
          )}
        >
          {galaxy.name}
        </span>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted-foreground">
          <span>{kind}</span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {memberLabel(galaxy.memberCount)}
          </span>
        </span>

        {featured ? (
          <span className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-accent-strong">
            进入星系
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        ) : null}
      </span>

      <ArrowRight
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground/40 transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-accent-strong",
          featured && "hidden sm:block",
        )}
        aria-hidden
      />
    </Link>
  );
}
