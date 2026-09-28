export type ReviewTone = "pending" | "approved" | "rejected" | "returned" | "withdrawn";

export type ReviewStatusMeta = {
  title: string;
  description: string;
  tone: ReviewTone;
  pulse: boolean;
};

export type ReviewStepState = "done" | "current" | "upcoming";

export const REVIEW_STEPS = ["已提交", "审核处理中", "审核完成"] as const;

export function resolveReviewStatusMeta(status: string | undefined): ReviewStatusMeta {
  switch ((status ?? "PENDING").toUpperCase()) {
    case "APPROVED":
      return {
        title: "审核通过",
        description: "内容已符合社区规范，可以正常展示",
        tone: "approved",
        pulse: false,
      };
    case "REJECTED":
      return {
        title: "审核未通过",
        description: "请根据审核意见修改后重新提交",
        tone: "rejected",
        pulse: false,
      };
    case "RETURNED":
      return {
        title: "审核已退回",
        description: "请根据审核意见修改内容后再次提交",
        tone: "returned",
        pulse: false,
      };
    case "WITHDRAWN":
      return {
        title: "已撤回审核",
        description: "你可以继续编辑草稿并重新提交",
        tone: "withdrawn",
        pulse: false,
      };
    default:
      return {
        title: "已提交审核，排队等待中",
        description: "你的稿件已进入审核队列，结果会通过通知告知你",
        tone: "pending",
        pulse: true,
      };
  }
}

export function resolveReviewStepStates(status: string | undefined): ReviewStepState[] {
  switch ((status ?? "PENDING").toUpperCase()) {
    case "APPROVED":
      return ["done", "done", "done"];
    case "REJECTED":
    case "RETURNED":
      return ["done", "done", "current"];
    case "WITHDRAWN":
      return ["current", "upcoming", "upcoming"];
    default:
      return ["current", "upcoming", "upcoming"];
  }
}

export function resolveReviewFeedback(
  status: string | undefined,
  decisionComment?: string | null,
): string {
  if (decisionComment?.trim()) {
    return decisionComment.trim();
  }

  switch ((status ?? "PENDING").toUpperCase()) {
    case "APPROVED":
      return "审核已通过，内容可以正常发布和展示。";
    case "REJECTED":
    case "RETURNED":
      return "审核意见暂未提供，请返回编辑器查看通知或联系支持。";
    case "WITHDRAWN":
      return "审核已撤回，你可以继续编辑并重新提交。";
    default:
      return "审核尚未完成，请耐心等待。";
  }
}

export function resolveArticleHref(status: string | undefined, articleId: string): string {
  return (status ?? "PENDING").toUpperCase() === "APPROVED"
    ? `/articles/${articleId}`
    : `/studio/content/${articleId}`;
}
