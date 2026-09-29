/*
 * Moderation contracts — "我的举报" and "我的申诉".
 *
 * VERIFIED 2026-09-27 against source (ModerationService + CommunityMeController)
 * and a live probe. All three endpoints sit under `/api/v1/me/*` and return 401
 * for a guest:
 *
 *   GET  /me/reports                     bare UserReportView[]      (no limit param!)
 *   GET  /me/reports/{reportId}          UserReportDetailView / 404 if not yours
 *   POST /me/reports/{reportId}/supplements  { body } → ReportSupplementView
 *   GET  /me/appeals?limit=20            bare AppealDetailView[]
 *   GET  /me/appeals/{appealId}          AppealDetailView / 404 if not yours
 *
 * ⚠️ THE LEGACY STATUS LABEL MAP IS WRONG — DO NOT COPY IT.
 *
 * Legacy (`app/reports/page.tsx`) maps
 *   PENDING → 处理中, UNDER_REVIEW → 审核中, RESOLVED → 已处理, CLOSED → 已关闭
 * but the backend NEVER writes PENDING, UNDER_REVIEW or RESOLVED anywhere.
 * A full-backend grep of `setStatus("...")` on report/appeal/case yields exactly
 * these literals:
 *   report: SUBMITTED (on create) → CLOSED (on resolution)
 *   case:   OPEN (on create)      → CLOSED (on resolution)
 *   appeal: SUBMITTED (on create) → DECIDED (on decision)
 *   (plus `TRIAGED` for case status, which is accepted by the guard at
 *    ModerationService:322 — `Set.of("SUBMITTED", "TRIAGED").contains(...)`)
 * So Legacy would render 4 of its own labels as the raw enum string — the label
 * map is aspirational, not observed. V2 maps ONLY the values that can occur and
 * falls back to echoing the raw value for anything unknown.
 *
 * Nullability that shapes the UI (all from ModerationService.getMyReport):
 *   `caseId`, `caseStatus`, `measureId` are null until a moderation case is
 *   opened / a measure is issued. A report that is still `SUBMITTED` has
 *   caseId = null — so "关联案件" must render as absent, not as an empty box.
 *   This is exactly the kind of field the UI must not fabricate a value for.
 */

/**
 * One row of `GET /api/v1/me/reports`.
 *
 * NOTE: `listMyReports` takes NO limit parameter — the controller method has no
 * `@RequestParam`. The full list is always returned. Do not add a `?limit=`.
 */
export type UserReportView = {
  id: string;
  status: string;
  /** OBJECT type of the reported thing, e.g. ARTICLE / COMMENT / MOMENT / USER. */
  targetType: string;
  targetId: string;
  /** Case's updatedAt when a case exists, else the report's own createdAt. */
  updatedAt: string;
};

/** The report's own description, as written by the reporter. */
export type UserReportDetailView = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
  /** null until a moderation case is opened against this report. */
  caseId: string | null;
  /** null whenever `caseId` is null. */
  caseStatus: string | null;
  /** null until a measure has been issued for the case. */
  measureId: string | null;
};

export type ReportSupplementView = {
  id: string;
  body: string;
  createdAt: string;
};

export type AppealDetailView = {
  id: string;
  caseId: string;
  body: string;
  status: string;
  createdAt: string;
};

export const APPEAL_LIST_LIMIT = 20;

/**
 * Report statuses the backend can actually write.
 *
 * Kept as a lookup so the UI renders a real label for real states and echoes
 * anything else verbatim, rather than silently rendering an unknown enum as a
 * blank cell or inventing a state the server never produces.
 */
const REPORT_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  TRIAGED: "已受理",
  CLOSED: "已关闭",
};

/** Appeal statuses the backend can actually write. */
const APPEAL_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  DECIDED: "已裁定",
};

/**
 * Label a report status.
 *
 * Unknown values are echoed unchanged — never mapped to a guess. If the backend
 * adds a status, it shows up as itself rather than as a wrong Chinese word.
 */
export function reportStatusLabel(status: string): string {
  return REPORT_STATUS_LABELS[status] ?? status;
}

export function appealStatusLabel(status: string): string {
  return APPEAL_STATUS_LABELS[status] ?? status;
}

/**
 * A report is still being worked on while its status is not CLOSED.
 *
 * Used to decide whether to offer the "补充说明" action: the server accepts a
 * supplement only while the report is `SUBMITTED` or `TRIAGED`
 * (ModerationService:322), so offering it on a CLOSED report would be a control
 * that always fails.
 */
export function isReportOpen(status: string): boolean {
  return status === "SUBMITTED" || status === "TRIAGED";
}

/** Whether this report has a moderation case attached yet. */
export function hasCase(report: Pick<UserReportDetailView, "caseId">): boolean {
  return report.caseId != null && report.caseId !== "";
}
