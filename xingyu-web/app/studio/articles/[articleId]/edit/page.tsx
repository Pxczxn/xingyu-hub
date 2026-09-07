"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  communityApi,
  type ArticleDraft,
  type CreationCategory,
  type TopicSummary,
} from "@/lib/community-api";

type SaveState = "saved" | "saving" | "error" | "idle";

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

export default function ArticleEditorPage() {
  const params = useParams<{ articleId: string }>();
  const articleId = params.articleId;
  const router = useRouter();

  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [categories, setCategories] = useState<CreationCategory[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockVersion = useRef(0);
  const latestPayload = useRef({
    title,
    summary,
    body,
    visibility,
    categoryId,
    topicIds,
    scheduledPublishAt,
  });

  useEffect(() => {
    latestPayload.current = {
      title,
      summary,
      body,
      visibility,
      categoryId,
      topicIds,
      scheduledPublishAt,
    };
  }, [
    title,
    summary,
    body,
    visibility,
    categoryId,
    topicIds,
    scheduledPublishAt,
  ]);

  useEffect(() => {
    Promise.all([
      communityApi.getArticleDraft(articleId),
      communityApi.listCategories().catch(() => []),
      communityApi.getTopics().catch(() => []),
    ])
      .then(([data, categoryList, topicList]) => {
        setDraft(data);
        setCategories(categoryList);
        setTopics(topicList);
        setTitle(data.title ?? "");
        setSummary(data.summary ?? "");
        setBody(data.body ?? "");
        setVisibility(data.visibility ?? "PUBLIC");
        setCategoryId(data.categoryId);
        setTopicIds(data.topicIds ?? []);
        setScheduledPublishAt(toDatetimeLocalValue(data.scheduledPublishAt));
        lockVersion.current = data.lockVersion;
        setSaveState("saved");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.problem.status === 404) {
          setError("文章不存在或无权编辑");
        } else {
          setError("加载失败，请稍后重试");
        }
      });
  }, [articleId]);

  const saveDraft = useCallback(async () => {
    const payload = latestPayload.current;
    setSaveState("saving");
    try {
      const updated = await communityApi.saveArticleDraft(articleId, {
        title: payload.title,
        body: payload.body,
        summary: payload.summary,
        visibility: payload.visibility,
        categoryId: payload.categoryId,
        topicIds: payload.topicIds,
        scheduledPublishAt: fromDatetimeLocalValue(payload.scheduledPublishAt),
        lockVersion: lockVersion.current,
      });
      lockVersion.current = updated.lockVersion;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [articleId]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraft();
    }, 1500);
  }, [saveDraft]);

  function handleFieldChange<T extends string>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T,
  ) {
    setter(value);
    scheduleSave();
  }

  function toggleTopic(topicId: string) {
    setTopicIds((prev) => {
      const next = prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId];
      return next;
    });
    scheduleSave();
  }

  async function handleTrash() {
    if (!confirm("确定将文章移入回收站？")) return;
    try {
      await communityApi.trashArticle(articleId);
      router.push("/studio/trash");
    } catch {
      setSaveState("error");
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Alert variant="destructive">{error}</Alert>
        <Link href="/studio" className="mt-4 inline-block text-sm underline">
          返回创作控制台
        </Link>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="px-4 py-8 text-sm text-muted-foreground sm:px-6">
        加载中…
      </main>
    );
  }

  return (
    <div className="xy-editor-page">
      <header className="xy-editor-top">
        <Link href="/studio/content">
          <ArrowLeft /> 返回列表
        </Link>
        <b>文章编辑中： {title || "无标题"}</b>
        <span>
          保存状态：
          <SaveIndicator state={saveState} />
        </span>
        <div>
          <Button variant="outline" asChild><Link href={`/studio/articles/${articleId}/preview`}><Eye />预览</Link></Button>
          <Button asChild>
            <Link href={`/studio/articles/${articleId}/submit`}>提交审核</Link>
          </Button>
        </div>
      </header>
      <main className="xy-editor-layout">
        <section className="xy-editor-canvas">
          <input
            value={title}
            onChange={(e) => handleFieldChange(setTitle, e.target.value)}
            placeholder="输入文章标题"
          />
          <textarea
            value={summary}
            onChange={(e) => handleFieldChange(setSummary, e.target.value)}
            placeholder="记录我在持续写作三年后的心得与方法…"
          />
          <div className="xy-editor-writing">
            <textarea
              className="xy-editor-body"
              value={body}
              onChange={(e) => handleFieldChange(setBody, e.target.value)}
              placeholder="开始写作…"
            />
            <Image
              src="/prototype-assets/article-editor/inline-image.png"
              alt="文中插图"
              width={416}
              height={246}
            />
          </div>
          <div className="xy-editor-status">
            ☁ 草稿会自动保存　　上传状态由当前操作实时显示
          </div>
        </section>
        <aside className="xy-editor-side">
          <h2>发布设置</h2>
          <section>
            <Label>封面图</Label>
            <div className="xy-editor-cover">
              <Image
                src="/prototype-assets/article-editor/cover-preview.png"
                alt="封面图预览"
                width={117}
                height={72}
              />
              <span>
                当前封面<small>尺寸信息暂未提供</small>
              </span>
              <Button variant="outline" size="sm" disabled title="封面上传接口暂未提供">
                更换图片
              </Button>
            </div>
          </section>
          <section>
            <Label>话题（可选）</Label>
            <div className="xy-editor-topics">
              {topics.length ? (
                topics.map((t) => (
                  <button
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    className={topicIds.includes(t.id) ? "active" : ""}
                    key={t.id}
                  >
                    # {t.name} ×
                  </button>
                ))
              ) : (
                <span>暂无已选择话题</span>
              )}
            </div>
          </section>
          <section>
            <Label htmlFor="category">个人分类 *</Label>
            <select
              id="category"
              value={categoryId ?? ""}
              onChange={(e) => {
                setCategoryId(e.target.value || null);
                scheduleSave();
              }}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </section>
          <section>
            <Label htmlFor="visibility">可见范围 *</Label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => handleFieldChange(setVisibility, e.target.value)}
            >
              <option value="PUBLIC">公开（所有人可见）</option>
              <option value="UNLISTED">不公开收录</option>
              <option value="PRIVATE">私密</option>
            </select>
          </section>
          <section>
            <Label htmlFor="scheduled">定时发布</Label>
            <input
              id="scheduled"
              type="datetime-local"
              value={scheduledPublishAt}
              onChange={(e) => {
                setScheduledPublishAt(e.target.value);
                scheduleSave();
              }}
            />
          </section>
          <Button variant="outline" onClick={() => void handleTrash()}>
            <Trash2 />
            删除草稿
          </Button>
        </aside>
      </main>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        保存中…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-accent">
        <Check className="h-4 w-4" />
        已保存
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-sm text-red-600">保存失败</span>;
  }
  return null;
}
