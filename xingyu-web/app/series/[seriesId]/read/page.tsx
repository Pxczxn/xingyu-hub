"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function SeriesReadPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [lineWidth, setLineWidth] = useState<"narrow" | "medium" | "wide">("medium");
  const {
    data: series,
    loading,
    error,
  } = useAsyncData(() => communityApi.getSeries(seriesId), [seriesId]);
  const chapters = [...(series?.chapters ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const current = chapters[currentIndex] ?? chapters[0];
  const { data: article } = useAsyncData(
    () =>
      current
        ? communityApi.getArticle(current.articleId)
        : Promise.resolve(null),
    [current?.articleId],
  );
  async function openChapter(index: number) {
    const chapter = chapters[index];
    if (chapter) {
      setCurrentIndex(index);
      try {
        await communityApi.recordReadingProgress(seriesId, chapter.articleId);
      } catch {
        /* 状态由服务端决定 */
      }
    }
  }
  if (loading)
    return (
      <AppShell>
        <main className="xy-reader-loading">正在打开阅读器…</main>
      </AppShell>
    );
  if (error || !series)
    return (
      <AppShell>
        <main className="xy-reader-loading">
          <Alert variant="destructive">{error || "系列不存在或无权访问"}</Alert>
        </main>
      </AppShell>
    );
  const paragraphs =
    article?.body?.split(/\n+/).filter(Boolean).slice(0, 8) ?? [];
  return (
    <AppShell>
      <main className="xy-series-reader">
        <aside className="xy-reader-directory">
          <div className="xy-reader-dir-head">
            <Link href={`/series/${seriesId}`}>
              <ChevronLeft />
              返回系列
            </Link>
            <h2>{series.title}</h2>
            <p>
              {chapters.length} 章 · {series.status}
            </p>
          </div>
          <ol>
            {chapters.map((chapter, index) => (
              <li key={chapter.id} className={index === currentIndex ? "is-active" : ""}>
                <button type="button" onClick={() => void openChapter(index)}>
                  <span>
                    {index === currentIndex ? (
                      <Check />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <div>
                    <b>{chapter.title || `章节 ${chapter.position}`}</b>
                    <small>{index === currentIndex ? "当前章节" : "章节内容"}</small>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <article className="xy-reader-article">
          <div className="xy-reader-progress">
            <span style={{ width: chapters.length ? `${((currentIndex + 1) / chapters.length) * 100}%` : "0%" }} />
            <p>{chapters.length ? `${currentIndex + 1} / ${chapters.length}` : "暂无章节"}</p>
          </div>
          {current ? (
            <div className="xy-reader-copy" style={{ fontSize, maxWidth: lineWidth === "narrow" ? 680 : lineWidth === "wide" ? 960 : 820 }}>
              <span className="xy-series-tag">
                第 {String(current.position).padStart(2, "0")} 章
              </span>
              <h1>{article?.title || current.title || "章节标题暂未提供"}</h1>
              <p className="xy-reader-lead">
                {article?.summary || "本章摘要暂未提供。"}
              </p>
              <Image
                src="/prototype-assets/series-read/article-figure.png"
                alt=""
                aria-hidden="true"
                width={772}
                height={184}
              />
              {paragraphs.length ? (
                paragraphs.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>正文内容暂未提供。</p>
              )}
            </div>
          ) : (
            <div className="xy-reader-copy">
              <h1>暂无可阅读章节</h1>
              <p>该系列发布章节后会显示在这里。</p>
            </div>
          )}
          <footer>
            <Button variant="outline" disabled={currentIndex <= 0} onClick={() => void openChapter(currentIndex - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              上一篇
            </Button>
            <Button onClick={() => void openChapter(currentIndex)} disabled={!current}>
              <BookOpen className="mr-2 h-4 w-4" />
              标记已读
            </Button>
            <Button variant="outline" disabled={currentIndex >= chapters.length - 1} onClick={() => void openChapter(currentIndex + 1)}>
              下一篇
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </footer>
        </article>
        <aside className="xy-reader-tools">
          <section>
            <h3>阅读进度</h3>
            <b>{chapters.length ? `${Math.round(((currentIndex + 1) / chapters.length) * 100)}%` : "—"}</b>
            <p>{chapters.length ? `第 ${currentIndex + 1} 章 / 共 ${chapters.length} 章` : "暂无章节"}</p>
          </section>
          <section>
            <h3>
              <Settings2 />
              显示设置
            </h3>
            <label>
              字号
              <div>
                <button type="button" onClick={() => setFontSize((value) => Math.max(15, value - 1))} aria-label="减小字号">
                  <Minus />
                </button>
                <span>{fontSize}</span>
                <button type="button" onClick={() => setFontSize((value) => Math.min(24, value + 1))} aria-label="增大字号">
                  <Plus />
                </button>
              </div>
            </label>
            <label>
              行宽
              <div className="xy-width-switch">
                {[['narrow','窄'],['medium','适中'],['wide','宽']].map(([value, label]) => <button type="button" key={value} className={lineWidth === value ? "is-active" : ""} onClick={() => setLineWidth(value as typeof lineWidth)}>{label}</button>)}
              </div>
            </label>
          </section>
          <section>
            <h3>本章目录</h3>
            <p>文章目录由正文结构生成，当前接口暂未提供。</p>
          </section>
        </aside>
      </main>
    </AppShell>
  );
}
