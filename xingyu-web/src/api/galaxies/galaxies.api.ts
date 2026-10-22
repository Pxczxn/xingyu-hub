import { apiRequest } from "@/api/client";
import type {
  GalaxyContent,
  GalaxyContentSubmission,
  GalaxyJoinRequest,
  GalaxyMember,
  GalaxySummary,
} from "./galaxies.types";

export const galaxiesApi = {
  /* Public reads. Guest-reachable, no token required. */
  list: (): Promise<GalaxySummary[]> => apiRequest<GalaxySummary[]>("/api/v1/galaxies"),

  getBySlug: (slug: string): Promise<GalaxySummary> =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}`),

  listMembers: (slug: string, limit = 50): Promise<GalaxyMember[]> =>
    apiRequest<GalaxyMember[]>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/members?limit=${encodeURIComponent(limit)}`,
    ),

  listContent: (slug: string, limit = 20): Promise<GalaxyContent[]> =>
    apiRequest<GalaxyContent[]>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/content?limit=${encodeURIComponent(limit)}`,
    ),

  /* Membership. All three need a session; guests get 401. */

  /**
   * The galaxies the caller has JOINED (Phase 3I: also the data behind
   * `/me/galaxies`). A bare `GalaxySummary[]` — the same shape as `list()`, so
   * the two are interchangeable downstream.
   */
  listMine: (): Promise<GalaxySummary[]> => apiRequest<GalaxySummary[]>("/api/v1/me/galaxies"),

  join: (slug: string): Promise<GalaxySummary> =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}/join`, {
      method: "POST",
    }),

  /**
   * 自主退出星系（Galaxy Membership Closure，2026-10-10）。
   * DELETE /galaxies/{slug}/members：成员 204；非成员/重复退出 404；
   * 非 MEMBER 角色 409；未登录 401。
   */
  leave: (slug: string): Promise<void> =>
    apiRequest<void>(`/api/v1/galaxies/${encodeURIComponent(slug)}/members`, {
      method: "DELETE",
    }),

  apply: (slug: string, message?: string): Promise<GalaxyJoinRequest> =>
    apiRequest<GalaxyJoinRequest>(`/api/v1/galaxies/${encodeURIComponent(slug)}/apply`, {
      method: "POST",
      body: message === undefined ? {} : { message },
    }),

  /*
   * 内容推荐（Galaxy Content Contribution，V054）。成员才能提交：
   * 游客 401、非成员 403、作品不可公开或已上架 409 —— 前端不复制这些判断，
   * 直接展示后端给出的原因。
   */

  /** 推荐一篇自己的作品到该星系；成功即进入 PENDING 待审核。 */
  submitContent: (
    slug: string,
    payload: { objectType: string; objectId: string; note?: string },
  ): Promise<GalaxyContentSubmission> =>
    apiRequest<GalaxyContentSubmission>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/content-submissions`,
      { method: "POST", body: payload },
    ),

  /** 我在该星系的推荐记录与审核状态。 */
  listMySubmissions: (slug: string, limit = 20): Promise<GalaxyContentSubmission[]> =>
    apiRequest<GalaxyContentSubmission[]>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/content-submissions/mine?limit=${encodeURIComponent(limit)}`,
    ),
};
