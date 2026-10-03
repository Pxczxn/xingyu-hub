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
 * a second marketing pitch — so this drops the artwork, the corner accent and the
 * large title, and halves the vertical padding. It is a prop rather than a
 * className override because the title size is baked into the heading here.
 *
 * 2026-10-03 (layout pass) — hierarchy and flatness:
 *
 *   - The title was 24px, the same size as the section headings below it, so the
 *     banner did not read as the top of the page. It now uses the `display` step
 *     (28px) and the eyebrow uses `.eyebrow`, which carries a short gold rule and
 *     resolves through --accent-strong (the raw brand gold measures 2.01:1 on
 *     cream and was effectively invisible at 11px).
 *   - The decorative corner was a 176px `blur-2xl` blob. It is now a flat
 *     gold-tinted disc: same "this corner is brand" signal, no filter cost, and it
 *     matches the flat-surface rule in MASTER.md.
 *   - The illustration slot was `hidden sm:block`; it is now `hidden lg:block` so
 *     it stops competing with the text at tablet widths where the two columns
 *     have already stacked.
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
   * Reduced banner: no artwork, no corner accent, smaller title, less height. Use it when the
   * visitor is already signed in and the banner is a greeting rather than a pitch.
   */
  compact?: boolean;
  tone?: "gold" | "blue" | "violet";
  className?: string;
};

const TONE_CORNER: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  gold: "bg-accent-soft",
  blue: "bg-sky-100/70",
  violet: "bg-violet-100/70",
};

const TONE_ART: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  gold: "border-accent-line/70 bg-accent-soft text-accent-strong",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
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
        "relative overflow-hidden rounded-xl border border-border/70 bg-card",
        compact ? "px-5 py-4" : "px-5 py-6 sm:px-7 sm:py-7",
        className,
      )}
    >
      {/* Flat corner accent — replaces the old blurred blob. Sized down on
          narrow viewports, where 160px in the corner is a third of the card. */}
      {compact ? null : (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 sm:-right-14 sm:-top-14 sm:h-40 sm:w-40 sm:opacity-70",
            TONE_CORNER[tone],
          )}
        />
      )}

      {immersive && illustration ? (
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-end pr-7 opacity-95">
            {illustration}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex flex-col",
          compact ? "gap-3" : "gap-5 lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
          <h1
            className={cn(
              "font-semibold tracking-tight text-primary",
              compact ? "text-2xl" : "text-display",
            )}
          >
            {title}
          </h1>
          {description ? <p className="lede mt-2.5 max-w-xl sm:text-base">{description}</p> : null}
          {actions ? <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div> : null}
          {announcement ? <div className="mt-4 max-w-xl">{announcement}</div> : null}
        </div>

        {compact || immersive ? null : illustration ? (
          <div className="relative hidden shrink-0 lg:block" aria-hidden>
            {illustration}
          </div>
        ) : (
          <div
            aria-hidden
            className={cn("hidden shrink-0 rounded-xl border p-4 lg:block", TONE_ART[tone])}
          >
            <Orbit className="h-7 w-7" strokeWidth={1.5} />
          </div>
        )}

        {action ? <div className="relative shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
