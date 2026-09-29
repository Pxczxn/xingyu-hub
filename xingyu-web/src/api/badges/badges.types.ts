/*
 * Achievement badges (Phase 3A).
 *
 * VERIFIED against `MeEngagementService.badges` + `BadgeView`
 * (`record BadgeView(String id, String title, String description, boolean earned)`)
 * on 2026-09-28, and probed live (`GET /api/v1/me/badges` → 401 AUTH_REQUIRED).
 *
 * ⚠️ The list is FIXED AND COMPLETE on the server: `badges()` unconditionally
 * adds exactly five entries. It never returns an empty array for a logged-in
 * user, and it never grows. So an "empty state" for this endpoint is
 * unreachable — and more importantly, the audience-facing copy must NOT promise
 * "hidden badges waiting to be discovered" (Legacy did; see the page). There is
 * nothing hidden behind this endpoint.
 *
 * ⚠️ `earned` is DERIVED SERVER-SIDE from a live count, not stored. It is
 * therefore recomputed on every read — a badge can go back to unearned if the
 * condition stops holding (e.g. `prolific` reads `articles.size() >= 5`, and
 * `articles` excludes deleted rows). The UI must not claim a badge is
 * permanent, and no client-side caching of `earned` is safe.
 *
 * The five criteria, verbatim from the service:
 *   onboard    完成入门引导            onboarding.isCompleted()
 *   first-post 创建第一篇文章          articleCount >= 1
 *   prolific   拥有 5 篇以上文章       articleCount >= 5
 *   social     粉丝达到 10             followers >= 10
 *   profile    填写个人简介            profile.bio 非空白
 */

/** `BadgeView`. */
export type BadgeView = {
  /** Stable id: onboard | first-post | prolific | social | profile. */
  id: string;
  title: string;
  description: string;
  /** Recomputed per request — not a persisted award. */
  earned: boolean;
};

/** The badge ids the backend is known to emit, in the order it emits them. */
export const KNOWN_BADGE_IDS = ["onboard", "first-post", "prolific", "social", "profile"] as const;

/** Human-facing label for a known badge id, for use as a fallback heading. */
export const BADGE_ID_LABELS: Record<string, string> = {
  onboard: "入门完成",
  "first-post": "初次创作",
  prolific: "勤耕不辍",
  social: "社区之星",
  profile: "名片完善",
};
