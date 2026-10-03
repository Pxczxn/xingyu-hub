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
  className,
}: {
  startsAt: string | null | undefined;
  /** `large` for a page header, `compact` for a card in a grid. */
  size?: "compact" | "large";
  className?: string;
}) {
  const parts = eventDateParts(startsAt);
  const large = size === "large";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border border-accent-line/60 bg-card",
        large ? "w-[76px] gap-0.5 py-3" : "w-14 gap-0 py-1.5",
        className,
      )}
    >
      <span className={cn("font-medium text-accent-strong", large ? "text-meta" : "text-[10px]")}>
        {parts ? parts.month : "待定"}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums leading-none text-primary",
          large ? "text-[30px]" : "text-lg",
        )}
      >
        {parts ? parts.day : "—"}
      </span>
      {parts ? (
        <span className={cn("text-muted-foreground", large ? "text-meta" : "text-[10px]")}>
          {parts.weekday}
        </span>
      ) : null}
    </span>
  );
}
