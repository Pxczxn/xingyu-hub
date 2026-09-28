/*
 * Community events contract (Phase 2I-4, source-confirmed 2026-09-27).
 *
 * Controllers:
 *   CommunityEventController  @RequestMapping("/events")   — public reads
 *   CommunityMeController     @RequestMapping("/me")       — session writes
 *
 * DTOs:
 *   EventView            {id, slug, title, body, startsAt, endsAt, submissionOpen}
 *   EventSubmissionView  {id, eventId, objectType, objectId, objectTitle, note, status, createdAt}
 *
 * ── Endpoints ───────────────────────────────────────────────────────────────
 * Public (no session):
 *   GET    /api/v1/events?limit=20                      -> EventView[]  BARE ARRAY
 *   GET    /api/v1/events/{eventId}                     -> EventView
 *   GET    /api/v1/events/{eventId}/submissions?limit=50 -> EventSubmissionView[] BARE ARRAY
 * Session-scoped:
 *   POST   /api/v1/me/events/{eventId}/register          -> {id,eventId,status,createdAt}
 *   DELETE /api/v1/me/events/{eventId}/register          -> 204
 *   POST   /api/v1/me/events/{eventId}/submissions       -> EventSubmissionView
 *   GET    /api/v1/me/event-submissions?limit=20         -> EventSubmissionView[] BARE ARRAY
 *
 * ── Shapes and rules that will bite ─────────────────────────────────────────
 *
 * 1. EVERYTHING HERE IS A BARE ARRAY. There is no PageResult anywhere in this
 *    domain — no cursor, no total. `limit` is the only knob, and the server
 *    re-defaults it rather than erroring when it is <= 0 (20 / 50 / 20 — each
 *    endpoint has its OWN default, which is why they are not shared below).
 *
 * 2. `EventView` HAS NO STATUS FIELD. Visibility is decided server-side:
 *    `requireActiveEvent` throws 404 for a missing OR non-ACTIVE event, so an
 *    event a caller can read is by definition ACTIVE. There is therefore no
 *    "upcoming vs finished" flag to switch on — the only lifecycle signal the
 *    client gets is `submissionOpen`, plus the two timestamps.
 *
 *    This matters for copy: `submissionOpen === false` does NOT mean the event
 *    is over. It means submissions are closed, which the admin can toggle
 *    independently of `endsAt`. Do not render "已结束" from it.
 *
 * 3. `/events/{id}/submissions` RETURNS ONLY ACCEPTED ONES. The service calls
 *    `listAcceptedByEventId`, so a submission in SUBMITTED state is NOT in this
 *    list even though the author can see it via /me/event-submissions. A public
 *    list being empty therefore does not mean nobody submitted.
 *
 * 4. `body` IS THE EVENT DESCRIPTION, and `title` is the name. There is no
 *    cover image, no location, no capacity, no organizer — the UI must not
 *    imply fields the payload does not carry.
 *
 * 5. REGISTRATION AND SUBMISSION ARE DIFFERENT THINGS. `register` records that
 *    a user intends to take part; `submit` attaches a piece of content. They are
 *    independent — registering does not submit, and submitting does not
 *    register. The product shows them as two actions for exactly this reason.
 *
 * 6. REGISTRATION IS IDEMPOTENT AND RE-REGISTERABLE. `register` returns the
 *    existing row when it is already REGISTERED (no error, no duplicate), and
 *    re-registers a CANCELLED row by clearing `cancelledAt`. So the response
 *    always describes a REGISTERED row, and there is no "already registered"
 *    error to handle. `cancelRegistration` answers 404 when there is nothing to
 *    cancel — that is the empty state, not a failure worth a banner.
 *
 * 7. SUBMISSION IS IDEMPOTENT ON (event, user, objectType, objectId). Replaying
 *    the same object returns the existing row rather than erroring. But it is
 *    gated twice:
 *      - 409 「活动投稿已关闭」 when `submissionOpen` is false,
 *      - 404 「投稿内容不存在」 when the object is not in `search_document`.
 *    The second one is the important trap: a DRAFT article is not in
 *    `search_document`, so submitting an unpublished article fails with "投稿
 *    内容不存在" — which reads like a server bug and is actually a rule. The
 *    submit UI therefore only offers PUBLISHED content (see the picker below).
 *
 * 8. `objectType` IS UPPERCASED SERVER-SIDE and must be one of the indexed
 *    types. `searchDocumentMapper.findByObject` uses (type, id) verbatim, so a
 *    lowercase "article" would miss. The client sends what the picker produced.
 *
 * 9. `status` ON A SUBMISSION IS THE REVIEW STATE: SUBMITTED (initial), then
 *    ACCEPTED or REJECTED (admin review normalizes APPROVED->ACCEPTED and
 *    DISMISSED->REJECTED). It is NOT a lifecycle of the event.
 */

export type SubmissionObjectType = "ARTICLE" | "SERIES" | "MOMENT";

export type EventView = {
  id: string;
  slug: string;
  title: string;
  /** The event description. Free text, may be empty. */
  body?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  /** Submissions are open. NOT a proxy for "the event is over" — see rule 2. */
  submissionOpen: boolean;
};

/** What a submission objectType is called in the UI. */
export const SUBMISSION_OBJECT_LABELS: Record<string, string> = {
  ARTICLE: "单篇文章",
  SERIES: "系列作品",
  MOMENT: "社区动态",
};

export type EventSubmissionView = {
  id: string;
  eventId: string;
  objectType: string;
  objectId: string;
  /** Server-resolved from `search_document`; null when the object is gone. */
  objectTitle?: string | null;
  note?: string | null;
  status: string;
  createdAt?: string | null;
};

/** The registration payload `POST /me/events/{id}/register` answers with. */
export type EventRegistration = {
  id: string;
  eventId: string;
  /** REGISTERED after a successful register; the endpoint never returns CANCELLED. */
  status: string;
  createdAt?: string | null;
};

/** Covers both the review state and the "已完成" grouping the UI needs. */
export function submissionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUBMITTED: "已投稿",
    PENDING: "审核中",
    ACCEPTED: "已通过",
    APPROVED: "已通过",
    REJECTED: "未通过",
  };
  return labels[status?.toUpperCase()] ?? status;
}

/** A submission is "done" once reviewed — the only terminal states. */
export function isSubmissionSettled(status: string): boolean {
  return ["ACCEPTED", "APPROVED", "REJECTED", "DISMISSED"].includes(status?.toUpperCase());
}

/** A submission is accepted (shown on the public list). */
export function isSubmissionAccepted(status: string): boolean {
  return ["ACCEPTED", "APPROVED"].includes(status?.toUpperCase());
}

/** ISO instant -> 「YYYY年M月D日 HH:mm」 in CST; missing/odd input -> null. */
export function formatEventDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

/** 「MM/DD」 in CST, for compact calendar/card use. */
export function formatEventDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

/**
 * Whether an event has finished, from `endsAt` alone.
 *
 * Deliberately NOT derived from `submissionOpen`: an admin can close
 * submissions while the event is still running, so the two disagree and only
 * `endsAt` describes the event itself. Returns null when the date is unknown,
 * because "we do not know" is not "finished".
 */
export function isEventEnded(event: EventView, now: number = Date.now()): boolean | null {
  if (!event.endsAt) return null;
  const end = new Date(event.endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return end.getTime() <= now;
}

/**
 * A human countdown to `endsAt`, or null when there is nothing honest to say.
 *
 * Null covers both "no end time" and "already finished" so the caller can pick
 * its own copy rather than parsing a string.
 */
export function eventCountdown(event: EventView, now: number = Date.now()): string | null {
  if (!event.endsAt) return null;
  const end = new Date(event.endsAt);
  if (Number.isNaN(end.getTime())) return null;
  const distance = end.getTime() - now;
  if (distance <= 0) return null;
  const totalHours = Math.floor(distance / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days} 天 ${String(hours).padStart(2, "0")} 小时` : `${hours} 小时`;
}
