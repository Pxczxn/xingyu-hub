"use client";

import Link from "next/link";
import { ChevronRight, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";

export default function NewMomentPage() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const moment = await communityApi.publishMoment(body.trim());
      router.push(`/moments/${moment.id}`);
    } catch {
      setError("发布失败，请确认已登录");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="xy-moment-compose">
        <header className="xy-compose-head">
          <div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="返回"
            >
              <ChevronRight className="rotate-180" />
            </Button>
            <span>
              <h1>发布动态</h1>
              <p>记录灵感，连接星辰大海</p>
            </span>
          </div>
          <div>
            <Button variant="outline" type="button" disabled title="动态草稿接口暂未提供">
              暂不支持草稿
            </Button>
            <Button type="submit" form="moment-compose" disabled={submitting}>
              <Send />
              {submitting ? "发布中…" : "发布"}
            </Button>
          </div>
        </header>
        {error && <Alert variant="destructive">{error}</Alert>}
        <form id="moment-compose" onSubmit={submit} className="xy-compose-grid">
          <section className="xy-compose-editor">
            <div className="xy-compose-text">
              <h2>
                此刻的想法是什么？ <small>{body.length}/3000</small>
              </h2>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={3000}
                placeholder="分享你的见解、故事、提问或生活瞬间…"
                required
              />
            </div>
            <footer>
              <ShieldCheck />
              发布即代表你同意遵守《星语社区内容规范》
              <span>自动保存于 14:30:25</span>
            </footer>
          </section>
          <aside className="xy-compose-side">
            <section className="xy-compose-preview">
              <h2>
                动态预览 <small>效果预览</small>
              </h2>
              <article>
                <header>
                  <i>星</i>
                  <span>
                    <b>
                      当前用户 <em>等级暂未提供</em>
                    </b>
                    <small>发布时间预览</small>
                  </span>
                </header>
                <p>
                  {body ||
                    "此刻的想法是什么？\n分享你的见解、故事、提问或生活瞬间…"}
                </p>
                <div className="xy-preview-image" />
                <footer>互动数据将在发布后显示</footer>
              </article>
              <p>预览仅供参考，实际效果以发布后为准</p>
            </section>
          </aside>
        </form>
        <aside className="xy-compose-tip">
          <Sparkles />
          <span>
            <b>创作小贴士</b>真诚分享、友善互动，优质内容更容易被推荐
          </span>
          <Button variant="link" asChild><Link href="/rules">去看规则 <ChevronRight /></Link></Button>
        </aside>
      </main>
    </AppShell>
  );
}
