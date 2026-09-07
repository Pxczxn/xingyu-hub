"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";

export default function NewSeriesPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const series = await communityApi.createSeries({
        title: title.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
      });
      router.push(`/studio/series/${series.id}/edit`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "创建失败");
      else setError("创建失败，请稍后重试");
      setSubmitting(false);
    }
  }

  return (
    <CompactPageShell
      eyebrow="创作中心"
      title="新建系列"
      description="创建连载系列并添加章节"
      width="sm"
      backHref="/studio/series"
      backLabel="返回列表"
    >
      <Card>
        <CardTitle>系列信息</CardTitle>
        <CardDescription className="mt-1">标题必填，别名用于公开 URL</CardDescription>
        <form className="mt-4 flex flex-col gap-3.5" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="title">标题</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="slug">别名（可选）</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-series" />
          </div>
          <div>
            <Label htmlFor="description">简介（可选）</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "创建中…" : "创建系列"}
          </Button>
        </form>
      </Card>
    </CompactPageShell>
  );
}
