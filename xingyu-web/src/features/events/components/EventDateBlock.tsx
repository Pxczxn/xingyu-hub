import { cn } from "@/lib/cn";

/*
 * The date block for an event — shared by the plaza card and the detail header.
 *
 * Why it exists as a component rather than two copies of the same markup: the
 * date is the P0 information on every event surface ("can I still make it?"),
 * and the two surfaces had already drifted apart once — the plaza card carried a
 * 12px chip while the detail header buried the date in a muted 12px line under
 * the title. Extracting it means the two cannot diverge again.
 *
 * Computed in Asia/Shanghai, matching every other formatter in the events
 * feature. Deriving the parts in the browser's own zone would print a day that
 * disagrees with the exact timestamp rendered beside it.
 */
const EVENT_TZ = "Asia/Shanghai";

function eventDateParts(value: string | null | undefined): {
  month: string;
  day: string;
  weekday: string;
} | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: EVENT_TZ }).format(date);
  return {
    month: part({ month: "long" }),
    day: part({ day: "numeric" }),
    weekday: part({ weekday: "short" }),
  };
}

export function EventDateBlock({
  startsAt,
  size = "compact",
  muted = false,
  className,
}: {
  startsAt: string | null | undefined;
  /** `large` for a page header, `compact` for a card in a grid. */
  size?: "compact" | "large";
  /**
   * Drops the gold. For a date that is already behind the reader — the plaza's
   * ended grid passes `muted={ended}`, so a finished event stops advertising
   * itself. The day number keeps `text-primary`: the date is still the P0 fact on
   * the card, and the only thing that has to stop competing is the accent.
   */
  muted?: boolean;
  className?: string;
}) {
  const parts = eventDateParts(startsAt);
  const large = size === "large";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border bg-card",
        muted ? "border-border" : "border-accent-line/60",
        large ? "w-[76px] gap-0.5 py-3" : "w-14 gap-0 py-1.5",
        className,
      )}
    >
      {/*
        The compact month and weekday labels take the 11px micro step rather than
        `text-meta`. That is a measurement, not a preference: at `text-meta`
        (13px, line-height 1.5) the three stacked lines total 69px, while the
        title-plus-two-line-excerpt column sitting beside the block is 63px — the
        block would overhang its own card. At 11px it lands on 63px exactly. The
        step is already part of the system either way: `.eyebrow` and every pill in
        the app are 11px.
      */}
      <span
        className={cn(
          "font-medium",
          muted ? "text-muted-foreground" : "text-accent-strong",
          large ? "text-meta" : "text-[11px]",
        )}
      >
        {parts ? parts.month : "待定"}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums leading-none text-primary",
          /*
           * `text-[30px]` stays arbitrary instead of becoming `text-display`. The
           * token carries its own `line-height` and `letter-spacing: -0.022em`,
           * which would then fight the `leading-none` next to it — decided by
           * stylesheet order rather than by intent. A display numeral wants to be
           * exactly one size with no tracking and no leading, so it is written as
           * exactly that.
           */
          large ? "text-[30px]" : "text-lg",
        )}
      >
        {parts ? parts.day : "—"}
      </span>
      {parts ? (
        <span className={cn("text-muted-foreground", large ? "text-meta" : "text-[11px]")}>
          {parts.weekday}
        </span>
      ) : null}
    </span>
  );
}
