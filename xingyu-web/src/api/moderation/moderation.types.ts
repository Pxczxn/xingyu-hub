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
 * Current real literals, re-verified 2026-10-07 after the Governance Contract
 * Recovery pass:
 *   report: SUBMITTED (on create) → CLOSED (on resolution)
 *   case:   OPEN (on create)      → CLOSED (on resolution)
 *   appeal: PENDING (on create)   → APPROVED | REJECTED (on decision)
 * `TRIAGED` is also accepted by the open-report guard in ModerationService.
 * So Legacy would render 4 of its own labels as the raw enum string — the label
 * map is aspirational, not observed. V2 maps ONLY the values that can occur and
 * falls back to echoing the raw value for anything unknown.
 *
 * <p>The appeal vocabulary changed in the Contract Recovery pass: the old model
 * wrote `DECIDED` for both approve and reject, so the DB structurally could not
 * answer "approved or rejected?". It is now PENDING → APPROVED / REJECTED, and
 * the result is readable from both `status` and `outcome`.
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
  /** OBJECT type of the reported thing, e.g. ARTICLE / COMMENT / MOMENT. */
  targetType: string;
  /** Target UUID. Returned by the API but NEVER rendered — users do not read ids. */
  targetId: string;
  /** Server-resolved title (article title; null for moment/comment). */
  targetTitle: string | null;
  /** Server-resolved excerpt (article summary / moment body / comment body). */
  targetSummary: string | null;
  /** The reason the reporter picked, so the list can answer "为什么举报". */
  reason: string;
  /** Case's updatedAt when a case exists, else the report's own createdAt. */
  updatedAt: string;
};

/** The report's own description, as written by the reporter. */
export type UserReportDetailView = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  /** Server-resolved title (article title; null for moment/comment). */
  targetTitle: string | null;
  /** Server-resolved excerpt (article summary / moment body / comment body). */
  targetSummary: string | null;
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
  /**
   * Every supplement the reporter has appended, oldest first.
   *
   * This is the READ half of `POST /me/reports/{id}/supplements`. The write path
   * has always existed, but the detail view used to send nothing back, so a
   * supplement vanished as soon as the page reloaded. The server now returns the
   * persisted list (ordered by real `createdAt`); the page renders it directly
   * instead of keeping an in-memory-only array.
   */
  supplements: ReportSupplementView[];
};

export type ReportSupplementView = {
  id: string;
  body: string;
  createdAt: string;
};

/**
 * The server's authoritative description of a report target.
 *
 * Returned by `GET /reports/target`. Everything here comes from the server —
 * the report form must NOT build a title/author from query params, because a
 * crafted URL could then claim the user is reporting something they are not.
 * `alreadyReported` lets the page say "you already reported this" honestly.
 */
export type ReportTargetView = {
  objectType: string;
  objectId: string;
  /** Article title, when the target is an article; null otherwise. */
  title: string | null;
  /** A short excerpt: article summary, moment body or comment body. */
  summary: string | null;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  alreadyReported: boolean;
};

export type AppealDetailView = {
  id: string;
  caseId: string;
  body: string;
  /**
   * PENDING / APPROVED / REJECTED — the single explicit appeal lifecycle.
   *
   * The old model wrote `DECIDED` for BOTH approve and reject, so the database
   * could not answer "approved or rejected?". `status` and `outcome` are now the
   * same value and are the only place the result lives.
   */
  status: string;
  /** Same vocabulary as `status`; kept separate so the DTO reads explicitly. */
  outcome: string;
  /** null while PENDING. */
  decidedAt: string | null;
  /** Reviewer's note; null while PENDING or when none was given. */
  decisionNote: string | null;
  /** The original moderated object's type (ARTICLE / MOMENT / COMMENT); null if unresolvable. */
  targetType: string | null;
  /** The original object UUID. Returned by the API but NEVER rendered. */
  targetId: string | null;
  /** Human description of the original object (server-resolved). */
  targetTitle: string | null;
  targetSummary: string | null;
  /** The original measure kind, i.e. "原决定" (e.g. HIDE_CONTENT); null if none. */
  measureType: string | null;
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
  PENDING: "待处理",
  APPROVED: "已批准",
  REJECTED: "已驳回",
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

/**
 * User-facing name for a reportable object type.
 *
 * Reporting is only ever offered for these three types (server whitelist), so
 * unknown values echo verbatim rather than being guessed. Shared by every
 * surface so "article" reads as 文章 everywhere, never as a raw enum.
 */
const OBJECT_TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  MOMENT: "动态",
  COMMENT: "评论",
};

export function objectTypeLabel(type: string | null | undefined): string {
  if (!type) return "内容";
  return OBJECT_TYPE_LABELS[type] ?? type;
}

/**
 * User-facing name for a moderation measure kind ("原决定").
 *
 * HIDE_CONTENT is the only measure the current executor produces. Unknown kinds
 * echo verbatim. Returns a generic phrase when there is no measure at all.
 */
const MEASURE_TYPE_LABELS: Record<string, string> = {
  HIDE_CONTENT: "隐藏内容",
  REMOVE_CONTENT: "移除内容",
  RESTRICT_USER: "限制账号",
};

export function measureTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return MEASURE_TYPE_LABELS[type] ?? type;
}

/**
 * User-facing name for a report reason.
 *
 * This is the SAME vocabulary the report form offers (NewReportPage), so what
 * the user picked is what they read back on 我的举报 / 举报详情. Without this the
 * list rendered the raw enum ("PLAGIARISM") — an internal token standing in for
 * a sentence the user themselves wrote in their own words one step earlier.
 * Unknown values echo verbatim rather than being guessed.
 */
const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "垃圾广告或刷屏",
  HARASSMENT: "骚扰或人身攻击",
  HATE_SPEECH: "仇恨或歧视言论",
  ILLEGAL: "违法违规内容",
  PLAGIARISM: "抄袭或侵权",
  OTHER: "其他",
};

export function reportReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "未填写";
  return REPORT_REASON_LABELS[reason] ?? reason;
}

/**
 * A short, honest one-line description of a report/appeal's subject.
 *
 * Title first (articles), else the excerpt, else a type-based fallback. This is
 * deliberately a *description of content*, never an id — it exists so no surface
 * ever has to render a UUID to stand in for "what this is about".
 */
export function targetDescription(view: {
  targetType?: string | null;
  targetTitle?: string | null;
  targetSummary?: string | null;
}): string {
  const title = view.targetTitle?.trim();
  if (title) return title;
  const summary = view.targetSummary?.trim();
  if (summary) return summary;
  return `${objectTypeLabel(view.targetType)}（内容已不存在或不可见）`;
}
