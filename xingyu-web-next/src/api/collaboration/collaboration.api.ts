/*
 * Collaboration invite API (Phase 2M).
 *
 * Three endpoints, verified against `CommunityCollaborationController`
 * (`@RequestMapping("/collaboration")`) and `CommunityMeController`:
 *
 *   POST /api/v1/me/collaboration-invites          -> create (auth required)
 *   GET  /api/v1/collaboration/invites/resolve     -> validate (PUBLIC)
 *   POST /api/v1/collaboration/invites/accept      -> accept (auth required)
 *
 * ⚠️ The create endpoint lives on the `/me` family while resolve/accept live on
 * the resource root `/collaboration` — the same read/write split seen with
 * reports/appeals. Probing `POST /collaboration/invites` for create would 405 and
 * look like a missing feature.
 *
 * ⚠️ Accept creates no collaboration relationship — see collaboration.types.ts.
 * This module deliberately does not try to paper over that.
 */
import { apiRequest } from "@/api/client";
import type {
  CollaborationAcceptResult,
  CollaborationInvite,
  CollaborationInviteResolve,
} from "./collaboration.types";

export const collaborationApi = {
  /**
   * Creates an invite link. `note` is optional; the backend trims a blank value
   * to null, so sending "" and sending undefined are equivalent.
   */
  createInvite: (note?: string): Promise<CollaborationInvite> =>
    apiRequest<CollaborationInvite>("/api/v1/me/collaboration-invites", {
      method: "POST",
      body: { note },
    }),

  /**
   * Validates a token WITHOUT consuming it, and needs no session.
   *
   * Returns `{valid: false}` (HTTP 200) for an unknown or expired token — that
   * is a normal answer, not an error, so callers must branch on `valid` rather
   * than on whether the request threw.
   */
  resolveInvite: (token: string): Promise<CollaborationInviteResolve> =>
    apiRequest<CollaborationInviteResolve>(
      `/api/v1/collaboration/invites/resolve?token=${encodeURIComponent(token)}`,
    ),

  /**
   * "Accepts" an invite.
   *
   * ⚠️ Despite the name this only VALIDATES and reports back. It writes nothing
   * (verified: `CollaborationService.acceptInvite` has no insert/update), so no
   * permission changes hands. Requires a session — a guest gets 401.
   *
   * Backend rejections:
   *   404 NOT_FOUND  邀请已失效或不存在  (unknown or expired token)
   *   409 CONFLICT   不能接受自己的邀请  (inviter === caller)
   */
  acceptInvite: (token: string): Promise<CollaborationAcceptResult> =>
    apiRequest<CollaborationAcceptResult>("/api/v1/collaboration/invites/accept", {
      method: "POST",
      body: { token },
    }),
};
