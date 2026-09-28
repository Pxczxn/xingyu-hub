/*
 * Pure helpers for the badge page (Phase 3A).
 *
 * ⚠️ THE CENTRAL FACT: the server returns a FIXED set of five badges and
 * recomputes `earned` on every read. Two consequences drive everything below:
 *
 *   1. There is no "discovery" and no hidden content. Legacy's footer said
 *      "更多隐藏徽章等待你去发现" — that is a promise the API cannot keep, and
 *      `countSecretBadges`-style copy would be a lie. The empty state is also
 *      unreachable for a logged-in user.
 *   2. Progress is a snapshot, not an archive. `earned` can flip back to false
 *      (the counts it derives from are live). So the summary must be phrased as
 *      "当前已点亮 N 枚", never as a permanent tally.
 */
import type { BadgeView } from "@/api/badges/badges.types";
import { BADGE_ID_LABELS } from "@/api/badges/badges.types";

export type BadgeTone = "earned" | "locked" | "unknown";

/**
 * `earned` is a real boolean from the server, so anything that is not
 * explicitly true is treated as not-earned — but we keep a third tone for a
 * value we do not understand, so a future non-boolean shape is visible rather
 * than silently rendered as "locked".
 */
export function badgeTone(badge: Pick<BadgeView, "earned">): BadgeTone {
  if (badge.earned === true) return "earned";
  if (badge.earned === false) return "locked";
  return "unknown";
}

export function isEarned(badge: Pick<BadgeView, "earned">): boolean {
  return badge.earned === true;
}

/** Titles fall back to a known-id label, then the raw id — never blank. */
export function badgeTitle(badge: Pick<BadgeView, "id" | "title">): string {
  const title = badge.title?.trim();
  if (title) return title;
  // `??` is not enough here: an empty id is a non-nullish value that would be
  // returned as an empty string. Every candidate must be truthy-checked.
  const label = BADGE_ID_LABELS[badge.id];
  if (label) return label;
  if (badge.id) return badge.id;
  return "未命名徽章";
}

/**
 * The description as shown. Locked badges keep the server's criterion text
 * (it tells the user what to do); we only supply a fallback when the server
 * sent nothing.
 */
export function badgeDescription(badge: Pick<BadgeView, "description" | "earned">): string {
  const description = badge.description?.trim();
  if (description) return description;
  return isEarned(badge) ? "已点亮这份成就。" : "继续参与社区即可解锁。";
}

/** How many are currently lit. A snapshot — see the module note. */
export function countEarned(badges: readonly BadgeView[]): number {
  return badges.filter(isEarned).length;
}

/**
 * Earned first, locked after, preserving the server's order inside each group.
 * The server's order is meaningful (it is roughly a difficulty ramp), so this
 * only lifts the lit ones up.
 */
export function sortForDisplay(badges: readonly BadgeView[]): BadgeView[] {
  const earned: BadgeView[] = [];
  const rest: BadgeView[] = [];
  for (const badge of badges) {
    if (isEarned(badge)) earned.push(badge);
    else rest.push(badge);
  }
  return [...earned, ...rest];
}

/**
 * Whether the server's response still looks like the fixed five.
 *
 * Used only to decide whether to show the "the set has changed" note — NOT to
 * filter the list. Unknown badges are always rendered (echoed), because
 * silently dropping a badge the backend just added is worse than showing one we
 * have no label for.
 */
export function hasUnknownBadges(badges: readonly BadgeView[]): boolean {
  return badges.some((badge) => !(badge.id in BADGE_ID_LABELS));
}
