"use client";

import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Send,
  Sparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function ArticlePublishPage() {
  const params = useParams<{ articleId: string }>();
  const articleId = params.articleId;
  const router = useRouter();
  const [draft, setDraft] = useState<Awaited<
    ReturnType<typeof communityApi.getArticleDraft>
  > | null>(null);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    communityApi
      .getArticleDraft(articleId)
      .then((data) => {
        setDraft(data);
        setScheduledPublishAt(toDatetimeLocalValue(data.scheduledPublishAt));
      })
      .catch(() => setError("无法加载文章草稿"));
  }, [articleId]);

  async function saveSettings() {
    if (!draft) return false;
    setSavingSchedule(true);
    setError(null);
    try {
      const updated = await communityApi.saveArticleDraft(articleId, {
        title: draft.title,
        body: draft.body,
        summary: draft.summary,
        visibility: draft.visibility,
        categoryId: draft.categoryId,
        topicIds: draft.topicIds,
        scheduledPublishAt: fromDatetimeLocalValue(scheduledPublishAt),
        lockVersion: draft.lockVersion,
      });
      setDraft(updated);
      setScheduledPublishAt(toDatetimeLocalValue(updated.scheduledPublishAt));
      return true;
    } catch {
      setError("保存发布设置失败");
      return false;
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!(await saveSettings())) {
        setSubmitting(false);
        return;
      }
      const result = await communityApi.submitArticle(articleId);
      router.push(`/studio/submissions/${result.submissionId}`);
    } catch {
      setError("提交审核失败，请确认文章已保存且内容完整");
      setSubmitting(false);
    }
  }

  if (!draft)
    return (
      <AppShell>
        <main className="xy-publish-loading">
          {error ? (
            <Alert variant="destructive">{error}</Alert>
          ) : (
            "正在加载发布设置…"
          )}
        </main>
      </AppShell>
    );
  return (
    <AppShell>
      <main className="xy-publish-settings">
        <header>
          <Link href={`/studio/articles/${articleId}/edit`}>← 返回编辑</Link>
          <h1>
            发布设置 <Sparkles />
          </h1>
          <p>设置文章的发布选项与分享信息</p>
        </header>
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="xy-publish-settings-grid">
          <section className="xy-publish-form">
            <PublishRow title="可见范围" description="选择文章的可见范围">
              <div className="xy-publish-visibility">
                {[
                  ["PUBLIC", "公开", "所有人可见"],
                  ["COMMUNITY", "社区可见", "登录用户可见"],
                  ["FOLLOWERS", "关注者可见", "仅关注者可见"],
                  ["PRIVATE", "仅自己可见", "仅自己可见"],
                ].map(([value, label, hint]) => (
                  <button
                    type="button"
                    className={draft.visibility === value ? "active" : ""}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        visibility: value as typeof draft.visibility,
                      })
                    }
                    key={value}
                  >
                    <i />
                    {label}
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            </PublishRow>
            <PublishRow
              title="定时发布"
              description="设定未来的发布时间（可选）"
            >
              <div className="xy-publish-schedule">
                <Input
                  id="scheduled-publish"
                  type="datetime-local"
                  value={scheduledPublishAt}
                  onChange={(e) => setScheduledPublishAt(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingSchedule}
                  onClick={() => void saveSettings()}
                >
                  <Clock3 />
                  {savingSchedule ? "保存中…" : "保存定时"}
                </Button>
                {scheduledPublishAt && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setScheduledPublishAt("")}
                  >
                    清除
                  </Button>
                )}
              </div>
            </PublishRow>
          </section>
          <aside className="xy-publish-tips">
            <h2>
              <Sparkles /> 分享与 SEO 小贴士
            </h2>
            <h3>分享建议</h3>
            <p>
              一张吸引人的封面图和清晰的摘要，能让你的文章在社交平台获得更多关注和分享。
            </p>
            <ul>
              <li>封面图推荐 16:9 比例，分辨率不低于 1200×675</li>
              <li>标题简洁有力，突出文章核心价值</li>
            </ul>
            <hr />
            <h3>SEO 建议</h3>
            <p>合理的设置有助于提升文章在搜索引擎中的表现：</p>
            <ul>
              <li>填写 Canonical 链接可避免内容重复问题</li>
              <li>使用准确的主题和标签，提升相关性</li>
              <li>定时发布可帮助规划内容节奏</li>
            </ul>
            <Image
              src="/prototype-assets/publish-settings/seo-illustration.png"
              alt="SEO 阅读建议插画"
              width={351}
              height={165}
            />
          </aside>
        </div>
        <footer className="xy-publish-footer">
          <span>
            <FileText />
            <b>草稿已保存</b>
            <small>最后保存时间由草稿状态提供</small>
          </span>
          <div>
            <Button type="button" variant="outline" disabled={savingSchedule} onClick={() => void saveSettings()}>{savingSchedule ? "保存中…" : "保存设置"}</Button>
            <Button disabled={submitting} onClick={() => void handleSubmit()}>
              <Send />
              {submitting ? "提交中…" : "发布文章"}
            </Button>
          </div>
        </footer>
      </main>
    </AppShell>
  );
}

function PublishRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="xy-publish-row">
      <span>
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <div>{children}</div>
    </section>
  );
}
