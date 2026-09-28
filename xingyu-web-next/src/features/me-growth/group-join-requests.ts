/*
 * Pure helpers for /me/requests — group join requests (Phase 3C).
 *
 * Source of truth: `MyGroupJoinRequestView` + `ConversationService`.
 *
 * Two contract facts that shape every decision below:
 *
 *   1. THE STATUS SET IS CLOSED: `PENDING` -> `APPROVED` | `REJECTED`
 *      (`ConversationService:339/360/382`). Legacy's three-label mapping happens
 *      to be exactly right, unlike its report-status mapping (§三·补4 got 3 of 4
 *      wrong). Same author, one page right and one wrong — which is why every
 *      mapping gets re-derived rather than reused.
 *
 *   2. `conversationTitle` IS NULLABLE. It only becomes null when the
 *      conversation row is gone; for a live group it is always set (`:177`).
 *      So a blank title means "the group is gone", and rendering a fabricated
 *      "群聊" over it would conceal a real state — the same reasoning as
 *      §三·补9's "do not dress up missing data".
 *
 * The page is therefore deliberately ASYMMETRIC with the rest of the app:
 * a missing group title is stated, not papered over.
 */
import type { MyGroupJoinRequest } from "@/api/messages/messages.types";
import {
  JOIN_MODE_APPROVAL,
  JOIN_REQUEST_APPROVED,
  JOIN_REQUEST_PENDING,
  JOIN_REQUEST_REJECTED,
} from "@/api/messages/messages.types";

/**
 * A display label for the request status.
 *
 * Only the three values the backend can write are translated. Anything else is
 * echoed verbatim, so a future state stays VISIBLE instead of rendering as a
 * blank chip (the containment rule from §三·补4).
 */
export function joinRequestStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case JOIN_REQUEST_PENDING:
      return "待处理";
    case JOIN_REQUEST_APPROVED:
      return "已通过";
    case JOIN_REQUEST_REJECTED:
      return "已拒绝";
    default:
      return status?.trim() || "状态未知";
  }
}

/** Only PENDING rows still depend on the group owner. */
export function isPending(request: Pick<MyGroupJoinRequest, "status">): boolean {
  return (request.status ?? "").toUpperCase() === JOIN_REQUEST_PENDING;
}

/**
 * Whether the group the request targets still exists.
 *
 * `conversationTitle` is the reachability signal: `ConversationService:177`
 * passes `conversation == null ? null : conversation.getTitle()`, so a null
 * title means the row is gone (or, defensively, that it has no title at all).
 */
export function groupIsGone(request: Pick<MyGroupJoinRequest, "conversationTitle">): boolean {
  return !request.conversationTitle?.trim();
}

/**
 * The heading for a request row.
 *
 * There is NO fabricated fallback here on purpose — a missing title is reported
 * as such by `groupIsGone`, and the caller renders that state explicitly. This
 * differs from other list pages (e.g. conversations fall back to "未命名群聊")
 * because there the row is still usable; here the target itself is gone.
 */
export function requestTitle(request: Pick<MyGroupJoinRequest, "conversationTitle">): string {
  return request.conversationTitle?.trim() ?? "";
}

/**
 * Splits the list the way the page presents it: what still needs the owner, and
 * what has been decided.
 *
 * Order is preserved inside each group (the server sorts `created_at DESC`).
 */
export function splitByPending(requests: readonly MyGroupJoinRequest[]): {
  pending: MyGroupJoinRequest[];
  resolved: MyGroupJoinRequest[];
} {
  const pending: MyGroupJoinRequest[] = [];
  const resolved: MyGroupJoinRequest[] = [];
  for (const request of requests) {
    if (isPending(request)) pending.push(request);
    else resolved.push(request);
  }
  return { pending, resolved };
}

/**
 * A short explanation of why the request is listed.
 *
 * Uses `joinMode` to distinguish an approval-gated group from an open one. An
 * `OPEN` group admitting anyone makes a request row anomalous, so that case says
 * so rather than pretending it is normal — mirroring the "unknown enum stays
 * visible" rule.
 */
export function joinModeNote(joinMode: string | null | undefined): string {
  switch ((joinMode ?? "").toUpperCase()) {
    case JOIN_MODE_APPROVAL:
      return "该群聊需要群主审批。";
    case "OPEN":
      return "该群聊可直接加入，通常无需申请。";
    default:
      return "";
  }
}

/** The applicant's own note, or "" — the field can be null OR a blank string. */
export function requestMessage(request: Pick<MyGroupJoinRequest, "message">): string {
  return request.message?.trim() ?? "";
}

/**
 * The conversation href for a request, or null when the target should not be
 * linked.
 *
 * ⚠️ V2's `/messages/:conversationId` route DOES handle groups (the thread page
 * tries DIRECT then falls back to GROUP on 404), so the link is real — unlike
 * Legacy's `/messages/group/{id}`, which V2 does not route.
 *
 * Returns null when the group is gone: there is nothing to open.
 */
export function requestConversationHref(
  request: Pick<MyGroupJoinRequest, "conversationId" | "conversationTitle">,
): string | null {
  if (groupIsGone(request)) return null;
  const id = request.conversationId?.trim();
  if (!id) return null;
  return `/messages/${encodeURIComponent(id)}`;
}

/** A stable React key. `id` IS present on this DTO (unlike PendingAction). */
export function requestKey(request: Pick<MyGroupJoinRequest, "id">): string {
  return request.id;
}
