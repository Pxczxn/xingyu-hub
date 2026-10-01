import type { ReactNode } from "react";
import { Orbit } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * The page banner used by every top-level surface.
 *
 * `actions` and `illustration` are additive slots:
 *   - `actions` renders UNDER the description, inside the text column. That is
 *     where a call to action belongs — putting it opposite the title (the old
 *     `action` slot) reads as a second column rather than a next step.
 *   - `illustration` replaces the default orbit badge when a page wants its own
 *     artwork. Callers that pass nothing keep the badge, so this stays
 *     non-breaking for the other six pages.
 *
 * `compact` is for a page that already knows who you are. The prototype asks for
 * 「登录：简洁欢迎语，不占太多空间」 — a reader who is signed in gets a greeting, not
 * a second marketing pitch — so this drops the artwork, the corner glow and the
 * large title, and halves the vertical padding. It is a prop rather than a
 * className override because the title size is baked into the heading here.
 */

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-hand slot, vertically centred against the title block. */
  action?: ReactNode;
  /** Buttons rendered under the description. */
  actions?: ReactNode;
  /** Replaces the default orbit badge. Ignored when `compact` is set. */
  illustration?: ReactNode;
  /** Lightweight contextual notice rendered beneath the hero actions. */
  announcement?: ReactNode;
  /** Uses the illustration as a quiet scene behind the content. */
  immersive?: boolean;
  /**
   * Reduced banner: no artwork, no glow, smaller title, less height. Use it when the
   * visitor is already signed in and the banner is a greeting rather than a pitch.
   */
  compact?: boolean;
  tone?: "gold" | "blue" | "violet";
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  action,
  actions,
  illustration,
  announcement,
  immersive = false,
  compact = false,
  tone = "gold",
  className,
}: PageHeroProps) {
  return (
    <section
      data-compact={compact ? "true" : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-none",
        immersive && "bg-card/90",
        compact ? "px-5 py-4" : "px-5 py-5 sm:px-8 sm:py-6",
        className,
      )}
    >
      {immersive && illustration ? (
        <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/25" />
          <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-end opacity-90">
            {illustration}
          </div>
        </div>
      ) : null}
      {compact ? null : (
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-80 blur-2xl",
            {
              "bg-accent/30": tone === "gold",
              "bg-sky-300/30": tone === "blue",
              "bg-violet-300/30": tone === "violet",
            },
          )}
        />
      )}
      <div
        className={cn(
          "relative z-10 flex flex-col",
          compact ? "gap-3" : "gap-5 sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-semibold tracking-tight text-primary",
              compact ? "text-xl" : "text-2xl sm:text-3xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div> : null}
          {announcement ? <div className="mt-4 max-w-xl">{announcement}</div> : null}
        </div>
        {compact || immersive ? null : illustration ? (
          <div className="relative hidden shrink-0 sm:block" aria-hidden>
            {illustration}
          </div>
        ) : (
          <div
            className="hidden shrink-0 rounded-full border border-border bg-background/70 p-4 sm:block"
            aria-hidden
          >
            <Orbit className="h-8 w-8 text-accent" strokeWidth={1.5} />
          </div>
        )}
        {action ? <div className="relative shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
