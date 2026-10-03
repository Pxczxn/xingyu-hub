/*
 * Feed timestamps.
 *
 * A feed row carries an instant, and a raw ISO string is noise to a reader, so
 * rows render a coarse age instead. `now` is always a parameter so tests never
 * depend on the wall clock.
 *
 * Deliberately coarse: a feed does not need second-level precision, and "刚刚"
 * reads better than "0 分钟前". Anything older than a month falls back to a
 * date, because "47 天前" is harder to place than "2026-08-12".
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

/** 「MM/DD」 in CST — the same timezone convention the rest of the app uses. */
const MONTH_DAY = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

/** 「YYYY/MM/DD」 in CST. */
const FULL_DATE = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A coarse age such as 「3 小时前」, or a date once the value is over a month old.
 * Returns null for a missing or unparseable value — callers render nothing
 * rather than an empty span.
 */
export function formatRelativeTime(value?: string | null, now: number = Date.now()): string | null {
  const date = toDate(value);
  if (!date) return null;

  const elapsed = now - date.getTime();
  // Clock skew between server and browser can place an instant slightly in the
  // future; treat that as "just now" instead of printing a negative age.
  if (elapsed < MINUTE) return "刚刚";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分钟前`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小时前`;
  if (elapsed < MONTH) return `${Math.floor(elapsed / DAY)} 天前`;
  return formatDay(date);
}

/** 「MM/DD」, for compact rows such as the announcement list. */
export function formatMonthDay(value?: string | null): string | null {
  const date = toDate(value);
  return date ? MONTH_DAY.format(date) : null;
}

/** 「YYYY/MM/DD」. */
export function formatFullDate(value?: string | null): string | null {
  const date = toDate(value);
  return date ? FULL_DATE.format(date) : null;
}

function formatDay(date: Date): string {
  return FULL_DATE.format(date);
}
