import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import {
  isSubmissionPending,
  submissionArticleHref,
  submissionStatusDescription,
  submissionStatusLabel,
  submissionTitle,
} from "@/api/submissions/submissions.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * /studio/submissions — 我的投稿 (Phase 2K-2)
 *
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 紧 / R 齐
 * --------------------------------------------------
 *   SK3 + 无 `rail` ⇒ `SOLO.SK3`：单列、与内容列同宽同边（R=齐）。
 *   H=壳：`WorkbenchShell` 无 heading，页内必须恰好 1 个 `h1`；首块是计数行、
 *        视觉没有标题位 → `sr-only`（A §7.2）。
 *   D=紧：每一条投稿是**一行**，不是一张卡 —— 没有逐项卡面、没有逐项圆角，
 *        行与行只靠一条发丝线分隔，行距走 `--density-list-gap`。这是它和同批
 *        `D=表` 的内容管理（列对齐可比较）、`D=松` 的投稿详情（独立卡面 + 右轨）
 *        能一眼分开的地方。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branches below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  if (loading) return <PageState kind="loading" />;

  if (failed === "auth") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="登录状态已过期" description="请重新登录后查看你的投稿。" />
        <p className="text-center">
          <Link to="/login" className="text-meta text-accent-strong hover:underline">
            去登录
          </Link>
        </p>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="section-gap">
        <PageState kind="error" title="投稿列表加载失败" description="请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  // 紧档的「量化带」是一句话，不是一个带：D=紧 的页面不该先占掉半屏。
  const pendingCount = items.filter((item) => isSubmissionPending(item.status)).length;

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="compact">
      {/* B 类壳：恰好 1 个 h1，视觉隐藏；首块仍是内容。 */}
      <h1 className="sr-only">我的投稿</h1>

      <p className="text-meta leading-6 text-muted-foreground">
        你提交审核的稿件及当前进展。
        {items.length > 0 ? ` 共 ${items.length} 条，其中 ${pendingCount} 条待审核。` : null}
      </p>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无投稿记录"
          description="从创作台提交稿件后，可以在这里查看审核进展。"
        />
      ) : (
        <ul
          aria-label="我的投稿列表"
          className="flex list-none flex-col divide-y divide-border/70 border-y border-border/70 p-0"
        >
          {items.map((item) => {
            const href = submissionArticleHref(item.status, item.articleId);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-[var(--density-list-gap)] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-h3 break-words text-primary">
                    <Link
                      to={`/studio/submissions/${encodeURIComponent(item.id)}`}
                      className="focus-ring rounded-sm hover:text-accent-strong"
                    >
                      {submissionTitle(item)}
                    </Link>
                  </h2>

                  <p className="text-meta leading-6 text-muted-foreground">
                    {submissionStatusDescription(item.status)}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
                    <time dateTime={item.submittedAt} className="tabular-nums">
                      提交于 {formatSubmittedAt(item.submittedAt)}
                    </time>
                    <Link
                      to={`/studio/submissions/${encodeURIComponent(item.id)}`}
                      className="focus-ring rounded-sm text-accent-strong hover:underline"
                    >
                      查看详情
                    </Link>
                    {href ? (
                      <Link to={href} className="focus-ring rounded-sm hover:text-foreground">
                        {item.status?.toUpperCase() === "APPROVED" ? "查看文章" : "去编辑"}
                      </Link>
                    ) : null}
                  </div>
                </div>

                <span className="w-fit shrink-0 rounded-pill border border-border px-2 py-0.5 text-caption text-muted-foreground">
                  {submissionStatusLabel(item.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ArchetypeFrame>
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
