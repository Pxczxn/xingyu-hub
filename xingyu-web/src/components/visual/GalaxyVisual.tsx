import { CircleDot, Network, Orbit, Sparkles, Users, Waypoints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const GALAXY_ICONS: LucideIcon[] = [Orbit, Network, Waypoints, Sparkles, Users, CircleDot];
const SURFACES = [
  "bg-card border-border/70",
  "bg-muted/70 border-border/60",
  "bg-accent/5 border-accent/25",
  "bg-primary/[0.04] border-primary/15",
];

export type GalaxyVisualVariant = "hero" | "official" | "spotlight" | "masthead" | "compact";

/** A stable constellation mark for a galaxy. It is decorative, never business data. */
export function GalaxyVisual({
  stableKey,
  official = false,
  variant = "compact",
  className,
}: {
  stableKey: string;
  official?: boolean;
  variant?: GalaxyVisualVariant;
  className?: string;
}) {
  const iconIndex = stableVariant(`${stableKey}:icon`, GALAXY_ICONS.length);
  const surfaceIndex = stableVariant(`${stableKey}:surface`, SURFACES.length);
  const layoutIndex = stableVariant(`${stableKey}:layout`, 3);
  const Icon = GALAXY_ICONS[iconIndex];

  return (
    <span
      aria-hidden
      data-testid="galaxy-visual"
      data-galaxy-visual-key={stableKey}
      data-galaxy-visual-variant={variant}
      data-galaxy-visual-composition={layoutIndex}
      className={cn(
        "relative block shrink-0 overflow-hidden border",
        variant === "hero"
          ? "h-36 w-full rounded-lg"
          : variant === "official"
            ? "h-28 w-56 rounded-lg"
            : variant === "spotlight"
              ? "h-24 w-44 rounded-lg"
              : variant === "masthead"
                ? "h-28 w-40 rounded-lg"
                : "h-16 w-16 rounded-md",
        SURFACES[surfaceIndex],
        className,
      )}
    >
      {variant === "hero" ? (
        <>
          <span className="absolute left-[18%] top-[16%] h-[62%] w-[62%] -rotate-[18deg] rounded-full border border-accent/35" />
          <span className="absolute left-[10%] top-[23%] h-[48%] w-[80%] rotate-[28deg] rounded-full border border-primary/20" />
          <span className="absolute left-[30%] top-[2%] h-[86%] w-[36%] rotate-[66deg] rounded-full border border-accent/20" />
          <span className="absolute left-[48%] top-[43%] h-3 w-3 rounded-full bg-accent/90 shadow-[0_0_0_5px_hsl(var(--accent)/0.12)]" />
          <span className="absolute left-[23%] top-[28%] h-1.5 w-1.5 rounded-full bg-primary/60" />
          <span className="absolute right-[21%] top-[22%] h-1.5 w-1.5 rounded-full bg-accent/70" />
          <span className="absolute right-[25%] bottom-[20%] h-1 w-1 rounded-full bg-primary/55" />
          <span className="absolute left-[31%] bottom-[18%] h-1 w-1 rounded-full bg-accent/60" />
          <span className="absolute left-[25%] top-[28%] h-px w-[27%] rotate-[22deg] bg-primary/20" />
          <span className="absolute right-[22%] top-[24%] h-px w-[18%] -rotate-[28deg] bg-primary/20" />
          <span className="absolute bottom-4 left-5 text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">
            GALAXIES
          </span>
          <span className="absolute bottom-4 right-5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55">
            XINGYU COMMUNITY
          </span>
        </>
      ) : (
        <span
          className={cn(
            "absolute rounded-full border border-accent/45",
            variant === "compact" ? "-right-5 -top-6 h-16 w-16" : "-right-8 -top-10 h-28 w-28",
          )}
        />
      )}
      {variant !== "hero" && layoutIndex === 0 ? (
        <>
          <span className="absolute left-3 top-3 h-px w-1/2 bg-primary/20" />
          <span className="absolute bottom-3 right-4 h-1.5 w-1.5 rounded-full bg-accent/80" />
        </>
      ) : variant !== "hero" && layoutIndex === 1 ? (
        <>
          <span className="absolute bottom-3 left-3 h-7 w-7 rounded-full border border-primary/15" />
          <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent/80" />
        </>
      ) : (
        <>
          <span className="absolute inset-x-3 bottom-3 h-px bg-primary/15" />
          <span className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-accent/80" />
        </>
      )}
      {variant !== "hero" ? (
        <span className="absolute inset-0 flex items-center justify-center text-primary/75">
          <Icon
            className={cn(
              variant === "compact" ? "h-5 w-5" : "h-8 w-8",
              official && "text-accent/90",
            )}
            strokeWidth={1.5}
          />
        </span>
      ) : null}
      {official && variant !== "hero" ? (
        <span className="absolute bottom-2 left-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          OFFICIAL
        </span>
      ) : null}
    </span>
  );
}
