"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";

type ReportPayload = { targetType: string; targetId: string; reason: string; detail: string };

export function ReportDialog({
  targetType,
  targetId,
  onSubmit,
}: {
  targetType: string;
  targetId: string;
  onSubmit?: (payload: ReportPayload) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { targetType, targetId, reason, detail };
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await communityApi.createReport({
          targetType,
          targetId,
          reason,
          detail: detail || undefined,
        });
      }
      setSent(true);
    } catch {
      setError("提交失败，请确认已登录");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag className="mr-1.5 h-4 w-4" />
        举报
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgb(var(--navy)/.38)] p-4">
          <section
            className="w-full max-w-md rounded-xl border border-border bg-card p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <h2 id="report-title" className="text-lg font-semibold">
              举报内容
            </h2>
            {sent ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                已提交。平台会按治理流程处理，并在需要时通知你。
              </p>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium">
                  原因
                  <select
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3"
                  >
                    <option value="">请选择原因</option>
                    <option value="SPAM">垃圾营销</option>
                    <option value="ABUSE">攻击或骚扰</option>
                    <option value="INFRINGEMENT">侵权内容</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label className="mt-4 block text-sm font-medium">
                  补充说明
                  <textarea
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-md border border-border bg-background p-3"
                  />
                </label>
                {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
              </>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {sent ? "关闭" : "取消"}
              </Button>
              {!sent ? (
                <Button onClick={() => void submit()} disabled={!reason || submitting}>
                  {submitting ? "提交中…" : "提交举报"}
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
