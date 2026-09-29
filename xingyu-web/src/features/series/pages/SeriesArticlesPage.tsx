import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesChapterRelation } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { articleDisplayTitle, apiErrorDetail, isNotFoundError } from "../series-labels";

type LoadState = "loading" | "error" | "notfound" | "ready";

export function SeriesArticlesPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [title, setTitle] = useState("");
  const [lockVersion, setLockVersion] = useState(0);
  const [chapters, setChapters] = useState<SeriesChapterRelation[]>([]);
  const [articles, setArticles] = useState<MyArticleSummary[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!id) {
      setLoadState("notfound");
      return;
    }
    let active = true;
    setLoadState("loading");
    Promise.all([seriesApi.getMine(id), articlesApi.listMine()])
      .then(([detail, list]) => {
        if (!active) return;
        setTitle(detail.title);
        setLockVersion(detail.lockVersion);
        setChapters(detail.chapters);
        setArticles(list);
        setLoadState("ready");
      })
      .catch((error) => {
        if (active) setLoadState(isNotFoundError(error) ? "notfound" : "error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= chapters.length) return;
    setChapters((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  }

  function addArticle(article: MyArticleSummary) {
    if (chapters.some((chapter) => chapter.articleId === article.id)) return;
    setChapters((current) => [
      ...current,
      {
        id: `local-${article.id}`,
        articleId: article.id,
        title: article.title,
        position: current.length + 1,
      },
    ]);
    setPickerOpen(false);
  }

  async function onSave() {
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setSaveError(null);
    try {
      const updated = await seriesApi.update(id, {
        chapterArticleIds: chapters.map((chapter) => chapter.articleId),
        lockVersion,
      });
      setLockVersion(updated.lockVersion);
      setChapters(updated.chapters);
    } catch (error) {
      setSaveError(apiErrorDetail(error, "保存失败，请稍后重试。"));
    } finally {
      pendingRef.current = false;
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <BackLink />
      </div>
    );
  }
  if (loadState === "notfound") {
    return (
      <div className="section-gap">
        <PageState kind="empty" title="系列不存在或无权编辑" />
        <BackLink />
      </div>
    );
  }

  const selected = new Set(chapters.map((chapter) => chapter.articleId));
  const available = articles.filter((article) => !selected.has(article.id));

  return (
    <div className="section-gap">
      <BackLink />
      <h1 className="text-xl font-semibold text-primary">{title}</h1>
      <h2 className="text-sm font-medium text-foreground">已收录文章</h2>
      {chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有收录文章。</p>
      ) : (
        <ol className="grid gap-2">
          {chapters.map((chapter, index) => (
            <li
              key={`${chapter.articleId}-${index}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div>
                <p className="text-sm text-foreground">{articleDisplayTitle(chapter.title)}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{chapter.articleId}</p>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => move(index, -1)}>
                  上移
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => move(index, 1)}>
                  下移
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pickerOpen ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium">选择要添加的文章</p>
          {available.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">没有可添加的文章。</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {available.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => addArticle(article)}
                  >
                    <span>{articleDisplayTitle(article.title)}</span>
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {article.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          添加文章
        </Button>
        <Button type="button" onClick={() => void onSave()}>
          保存排序
        </Button>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/studio/series" className="text-sm text-accent hover:underline">
      返回系列列表
    </Link>
  );
}
