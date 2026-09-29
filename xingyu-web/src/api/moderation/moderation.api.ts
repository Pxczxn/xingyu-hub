/*
 * Moderation clients — "我的举报" / "我的申诉".
 *
 * See moderation.types.ts for the verified contract and the warning about
 * Legacy's incorrect status label map.
 */
import { apiRequest } from "@/api/client";
import type {
  AppealDetailView,
  ReportSupplementView,
  UserReportDetailView,
  UserReportView,
} from "./moderation.types";
import { APPEAL_LIST_LIMIT } from "./moderation.types";

export const reportsApi = {
  /**
   * `GET /api/v1/me/reports` — every report the session user filed.
   *
   * Takes NO arguments on purpose: the controller method has no `@RequestParam`,
   * so there is no `limit` to pass and no cursor to follow.
   */
  listMine: (): Promise<UserReportView[]> => apiRequest<UserReportView[]>("/api/v1/me/reports"),

  /** 404 when the report exists but belongs to someone else. */
  getById: (reportId: string): Promise<UserReportDetailView> =>
    apiRequest<UserReportDetailView>(`/api/v1/me/reports/${encodeURIComponent(reportId)}`),

  /**
   * Append a supplement to a report.
   *
   * The server rejects a blank body with a field error, and only accepts
   * supplements while the report is SUBMITTED / TRIAGED — so callers should gate
   * this behind `isReportOpen(status)` rather than offering it unconditionally.
   */
  addSupplement: (reportId: string, body: string): Promise<ReportSupplementView> =>
    apiRequest<ReportSupplementView>(
      `/api/v1/me/reports/${encodeURIComponent(reportId)}/supplements`,
      { method: "POST", body: { body } },
    ),

  /**
   * `POST /api/v1/reports` — file a new report.
   *
   * Resource root, not `/me/reports` (see the appealsApi.submit note).
   *
   * Required: `objectType`, `objectId`, `reason`. `detail` is optional and is
   * `trimToNull`-ed server-side. Creating a report ALSO opens a moderation case
   * (`status: OPEN`) in the same transaction, which is why a freshly created
   * report always has a `caseId` — the nullable-case path in the detail view is
   * for pre-existing rows, not for new ones.
   *
   * The response is a Map, not the entity: `{ reportId, id, status }`.
   */
  submit: (payload: {
    objectType: string;
    objectId: string;
    reason: string;
    detail?: string;
  }): Promise<{ reportId: string; id: string; status: string }> =>
    apiRequest("/api/v1/reports", { method: "POST", body: payload }),
};

export const appealsApi = {
  listMine: (limit: number = APPEAL_LIST_LIMIT): Promise<AppealDetailView[]> =>
    apiRequest<AppealDetailView[]>(`/api/v1/me/appeals?limit=${limit}`),

  /** 404 when the appeal exists but belongs to someone else. */
  getById: (appealId: string): Promise<AppealDetailView> =>
    apiRequest<AppealDetailView>(`/api/v1/me/appeals/${encodeURIComponent(appealId)}`),

  /**
   * `POST /api/v1/appeals` — file an appeal against a moderation measure.
   *
   * NOTE the path is the resource root, NOT `/me/appeals`. The write path lives
   * in `CommunityAppealController @RequestMapping("/appeals")` while the read
   * paths are in `CommunityMeController` — a split that is easy to get wrong.
   * (Compare the createReport note below: the same split exists there.)
   *
   * The server requires an appealable measure: it resolves one from `measureId`
   * (direct) or `caseId` (latest measure of that case), and throws a field error
   * 「未找到可申诉的治理措施」 when neither resolves. So the caller must have a
   * real measureId/caseId from a report detail — there is no "appeal anything".
   */
  submit: (payload: {
    measureId?: string;
    caseId?: string;
    detail: string;
  }): Promise<{
    id: string;
    status: string;
  }> => apiRequest("/api/v1/appeals", { method: "POST", body: payload }),
};
