import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import {
  submissionArticleHref,
  submissionStatusDescription,
  submissionStatusLabel,
  submissionTitle,
} from "@/api/submissions/submissions.types";
import { PageState } from "@/components/shared/PageState";
import { Card, CardContent } from "@/components/ui/card";

/*
 * /studio/submissions — 我的投稿 (Phase 2K-2)
 *
 * READ-ONLY list of every review submission the session user filed.
 *
 * Legacy only ever showed the RETURNED + REJECTED subset (its "被退回的内容" page
 * filtered client-side after fetching). V2 lists them all and labels each one,
 * because "where did my submission go?" is answered by seeing WITHDRAWN and
 * APPROVED rows too, not just the failures.
 *
 * `GET /me/submissions` returns a BARE ARRAY with no cursor — so this is a single
 * bounded read and there is deliberately no pagination control.
 */
export function MySubmissionsPage() {
  const [items, setItems] = useState<ReviewSubmissionDetailView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<"auth" | "other" | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(null);

    submissionsApi
      .listMine()
      .then((rows) => {
        if (!active) return;
        setItems(rows);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error instanceof ApiError ? error.problem.status : 0;
        setFailed(status === 401 ? "auth" : "other");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PageState kind="loading" />;

  if (failed === "auth") {
    return (
      <PageState
        kind="error"
        title="登录状态已过期"
        description="请重新登录后查看你的投稿。"
      />
    );
  }
  if (failed) {
    return <PageState kind="error" title="投稿列表加载失败" description="请稍后重试。" />;
  }

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">我的投稿</h1>
        <p className="text-sm text-muted-foreground">
          你提交审核的稿件及当前进展。
        </p>
      </header>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无投稿记录"
          description="从创作台提交稿件后，可以在这里查看审核进展。"
        />
      ) : (
        <ul aria-label="我的投稿列表" className="flex list-none flex-col gap-3 p-0">
          {items.map((item) => {
            const href = submissionArticleHref(item.status, item.articleId);
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        <Link to={`/studio/submissions/${encodeURIComponent(item.id)}`} className="hover:text-accent">
                          {submissionTitle(item)}
                        </Link>
                      </h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {submissionStatusLabel(item.status)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {submissionStatusDescription(item.status)}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <time dateTime={item.submittedAt}>
                        提交于 {formatSubmittedAt(item.submittedAt)}
                      </time>
                      <Link
                        to={`/studio/submissions/${encodeURIComponent(item.id)}`}
                        className="hover:text-foreground"
                      >
                        查看详情
                      </Link>
                      {href ? (
                        <Link to={href} className="hover:text-foreground">
                          {item.status?.toUpperCase() === "APPROVED" ? "查看文章" : "去编辑"}
                        </Link>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Render the submission timestamp.
 *
 * Falls back to the raw string when it is not parseable rather than printing
 * "Invalid Date" — the wire format is ISO but we should not assert that.
 */
function formatSubmittedAt(value: string): string {
  if (!value) return "时间未知";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

