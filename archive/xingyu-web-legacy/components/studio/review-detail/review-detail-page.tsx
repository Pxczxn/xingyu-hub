"use client";
import styles from "./review-detail.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";
import { ReviewArticleSummary } from "./review-article-summary";
import {
  resolveArticleHref,
  resolveReviewFeedback,
  resolveReviewStatusMeta,
} from "./review-detail-meta";
import { ReviewFeedbackCard } from "./review-feedback-card";
import { ReviewStandardsPanel } from "./review-standards-panel";
import { ReviewStatusHeader } from "./review-status-header";
import { ReviewStepBar } from "./review-step-bar";
import { ReviewToolList } from "./review-tool-list";

export function ReviewDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId = params.submissionId?.trim();
  const { data: submission, loading, error } = useAsyncData(
    () => {
      if (!submissionId) {
        return Promise.reject(new Error("审核单地址无效"));
      }
      return communityApi.getMyReviewSubmission(submissionId);
    },
    [submissionId],
  );

  if (loading) {
    return (
      <AppShell>
        <main className={cn(styles.reviewLoading)}>正在加载审核详情…</main>
      </AppShell>
    );
  }

  if (error || !submission) {
    return (
      <AppShell>
        <main className={cn(styles.reviewError)}>
          <Alert variant="destructive">{error || "投稿不存在或无权查看"}</Alert>
          <Link href="/studio/content?tab=reviewing">返回审核列表</Link>
        </main>
      </AppShell>
    );
  }

  const statusMeta = resolveReviewStatusMeta(submission.status);
  const submittedAt = submission.submittedAt
    ? formatDateTime(submission.submittedAt)
    : "提交时间暂未提供";
  const feedback = resolveReviewFeedback(submission.status, submission.decisionComment);
  const articleHref = resolveArticleHref(submission.status, submission.articleId);
  const approved = submission.status.toUpperCase() === "APPROVED";

  return (
    <AppShell>
      <main className={cn(styles.reviewDetail)}>
        <div className={cn(styles.crumb)}>
          创作中心 <ChevronRight aria-hidden="true" /> <span>审核详情</span>
        </div>

        <section className={cn(styles.detailMain)}>
          <ReviewStepBar status={submission.status} />
          <ReviewStatusHeader meta={statusMeta} />
          <ReviewArticleSummary
            title={submission.title || "未命名投稿"}
            articleId={submission.articleId}
            submittedAt={submittedAt}
            coverUrl={submission.coverUrl}
          />
        </section>

        <aside className={cn(styles.detailSide)}>
          <ReviewFeedbackCard message={feedback} />
          <ReviewToolList articleHref={articleHref} approved={approved} />
          <ReviewStandardsPanel />
        </aside>

        <div className={cn(styles.mobileCta)}>
          <Link href={articleHref}>{approved ? "查看作品" : "查看稿件"}</Link>
        </div>
      </main>
    </AppShell>
  );
}
