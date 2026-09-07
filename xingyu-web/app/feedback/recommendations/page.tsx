"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { communityApi, type RecommendationFeedback } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

export default function RecommendationFeedbackPage() {
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RecommendationFeedback[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    communityApi
      .getRecommendationFeedback()
      .then(setHistory)
      .catch(() => {});
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const entry = await communityApi.submitRecommendationFeedback(body.trim());
      setHistory((prev) => [entry, ...prev].slice(0, 20));
      setBody("");
      setSaved(true);
    } catch {
      setError("提交失败，请确认已登录");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CompactPageShell eyebrow="反馈" title="推荐反馈" description="告诉我们推荐内容是否符合你的兴趣" width="sm" backHref="/" backLabel="返回首页">
      <Card>
        <CardTitle>提交反馈</CardTitle>
        <CardDescription className="mt-1">你的反馈会帮助我们改进推荐质量</CardDescription>
        <form className="mt-4 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <Label htmlFor="feedback">反馈内容</Label>
            <textarea
              id="feedback"
              className="mt-1 min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
            />
          </div>
          {saved && <Alert>感谢反馈，已提交</Alert>}
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button type="submit" disabled={!body.trim() || submitting}>
            {submitting ? "提交中…" : "提交反馈"}
          </Button>
        </form>
      </Card>

      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">历史反馈</h2>
          <ul className="mt-2 space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="whitespace-pre-wrap">{item.body}</p>
                <time className="mt-1.5 block text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </CompactPageShell>
  );
}
