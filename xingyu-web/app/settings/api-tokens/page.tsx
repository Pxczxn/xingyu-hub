"use client";

import { FormEvent, useEffect, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";

export default function ApiTokensSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    communityApi
      .getClientSettings()
      .then((settings) => setEnabled(settings.personalizedRecommendationEnabled !== false))
      .catch(() => setError("请先登录"))
      .finally(() => setLoading(false));
  }, []);

  async function saveRecommendationPreference(next: boolean) {
    setEnabled(next);
    await communityApi.updateClientSettings({ personalizedRecommendationEnabled: next });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    setCreatedToken(null);
    try {
      const created = await communityApi.createApiToken({ name: name.trim() });
      setCreatedToken(created.token);
      setName("");
    } catch {
      setError("创建 Token 失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CompactPageShell eyebrow="账户" title="开放 API" description="管理 API Token 与推荐偏好" width="sm" backHref="/settings" backLabel="返回设置">
      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <>
          <Card>
            <CardTitle>个性化推荐</CardTitle>
            <CardDescription className="mt-1">
              关闭后首页推荐将退化为运营精选与公共热门内容，不会使用你的行为画像。
            </CardDescription>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span>启用个性化推荐</span>
              <input type="checkbox" checked={enabled} onChange={(e) => void saveRecommendationPreference(e.target.checked)} />
            </label>
          </Card>

          <Card>
            <CardTitle>API Token</CardTitle>
            <CardDescription className="mt-1">Token 仅创建时展示一次，请妥善保存。</CardDescription>
            <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Token 名称，例如 CI 同步"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {error && <Alert variant="destructive">{error}</Alert>}
              {createdToken && (
                <Alert>
                  新 Token（请立即复制）：<code className="mt-2 block break-all text-xs">{createdToken}</code>
                </Alert>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "创建中…" : "创建 Token"}
              </Button>
            </form>
          </Card>
        </>
      )}
    </CompactPageShell>
  );
}
