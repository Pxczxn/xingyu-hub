import { apiRequest } from "@/api/client";
import type {
  EventRegistration,
  EventSubmissionView,
  EventView,
  SubmissionObjectType,
} from "./events.types";

/*
 * Community events API (Phase 2I-4).
 *
 * Endpoint shapes and the rules that bite are documented in events.types.ts.
 * The one thing worth repeating at the call site, because the two reads look
 * identical and are not:
 *
 *   /events/{id}/submissions   -> only ACCEPTED submissions (public list)
 *   /me/event-submissions      -> everything the CALLER submitted, any status
 *
 * Everything in this domain returns a bare array or a bare object — there is no
 * PageResult and no cursor anywhere, so nothing here unwraps an envelope.
 *
 * `limit` is passed through and the server clamps it; each endpoint has its own
 * default (20 / 50 / 20), so the defaults live here rather than in one shared
 * constant that would silently be wrong for two of the three.
 */
export const eventsApi = {
  /** ACTIVE events only — the server 404s a non-ACTIVE one rather than hiding it. */
  list: (limit = 20): Promise<EventView[]> =>
    apiRequest<EventView[]>(`/api/v1/events?limit=${encodeURIComponent(String(limit))}`),

  /** 404 when the event is missing or not ACTIVE. */
  get: (eventId: string): Promise<EventView> =>
    apiRequest<EventView>(`/api/v1/events/${encodeURIComponent(eventId)}`),

  /**
   * The public submission list for an event: ACCEPTED rows only.
   *
   * An empty result does NOT mean nobody submitted — rows still under review
   * are invisible here by design (see rule 3 in events.types.ts).
   */
  listAcceptedSubmissions: (eventId: string, limit = 50): Promise<EventSubmissionView[]> =>
    apiRequest<EventSubmissionView[]>(
      `/api/v1/events/${encodeURIComponent(eventId)}/submissions?limit=${encodeURIComponent(String(limit))}`,
    ),

  /**
   * Every submission the caller has made, in any review status.
   *
   * `limit` is NOT passed: the endpoint takes one but the caller wants the full
   * picture, and the server caps it anyway. Passing a small limit here would
   * silently truncate "我的活动" with no indication that it had.
   */
  listMySubmissions: (limit = 100): Promise<EventSubmissionView[]> =>
    apiRequest<EventSubmissionView[]>(
      `/api/v1/me/event-submissions?limit=${encodeURIComponent(String(limit))}`,
    ),

  /**
   * Registers the caller for an event.
   *
   * Idempotent, and re-registerable after a cancel — the answer always
   * describes a REGISTERED row, so there is no "already registered" error case
   * to handle. 404 when the event is missing or not ACTIVE.
   */
  register: (eventId: string): Promise<EventRegistration> =>
    apiRequest<EventRegistration>(
      `/api/v1/me/events/${encodeURIComponent(eventId)}/register`,
      { method: "POST" },
    ),

  /**
   * Cancels the caller's registration. Answers 204.
   *
   * 404 when there is nothing to cancel — that is the empty state, and callers
   * should treat it as such rather than surfacing an error.
   */
  cancelRegistration: (eventId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/events/${encodeURIComponent(eventId)}/register`, {
      method: "DELETE",
    }),

  /**
   * Submits a piece of the caller's content to an event.
   *
   * Two failures worth naming at the call site because the server's wording is
   * unhelpful about the cause:
   *   - 409 「活动投稿已关闭」 when the event is not accepting submissions,
   *   - 404 「投稿内容不存在」 when the object is not in `search_document` —
   *     which is what a DRAFT article produces, since drafts are not indexed.
   *
   * Idempotent on (event, user, objectType, objectId): replaying the same
   * object returns the existing submission instead of creating a second one.
   */
  submit: (
    eventId: string,
    payload: { objectType: SubmissionObjectType; objectId: string; note?: string },
  ): Promise<EventSubmissionView> =>
    apiRequest<EventSubmissionView>(
      `/api/v1/me/events/${encodeURIComponent(eventId)}/submissions`,
      { method: "POST", body: payload },
    ),
};
