import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { SearchField } from "@/components/shared/SearchField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { articleDisplayState, articleDisplayTitle } from "../series-labels";
import { ArticleStateBadge } from "./SeriesStatusBadge";

type ArticlePickerPanelProps = {
  articles: MyArticleSummary[];
  selectedIds: ReadonlySet<string>;
  open: boolean;
  onAdd: (article: MyArticleSummary) => void;
  onClose: () => void;
};

/**
 * Article picker for the arrangement page.
 *
 * It is an inline panel, not a modal: adding several chapters in a row is the
 * normal case, and a dialog would make every pick a close/reopen cycle. On
 * desktop it sits in a sticky right column; below `lg` it is revealed by the
 * "添加文章" button and ordered above the chapter list.
 *
 * Rows are always shown with their real editorial state. Being in the series
 * does not make a draft readable, so the panel never presents "已添加" as
 * "已公开".
 */
export function ArticlePickerPanel({
  articles,
  selectedIds,
  open,
  onAdd,
  onClose,
}: ArticlePickerPanelProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const matched = useMemo(() => {
    if (!trimmedQuery) return articles;
    return articles.filter((article) =>
      articleDisplayTitle(article.title).toLowerCase().includes(trimmedQuery),
    );
  }, [articles, trimmedQuery]);

  const availableCount = articles.filter((article) => !selectedIds.has(article.id)).length;

  return (
    <section
      aria-labelledby="series-picker-heading"
      data-testid="article-picker"
      className={cn(
        "order-1 flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4 lg:order-2 lg:sticky lg:top-24 lg:flex",
        open ? "flex" : "hidden lg:flex",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="series-picker-heading" className="text-sm font-semibold text-primary">
            添加文章
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {articles.length === 0 ? "你的文章会显示在这里" : `${availableCount} 篇可添加`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs lg:hidden"
          onClick={onClose}
        >
          收起
        </Button>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        ariaLabel="搜索我的文章"
        placeholder="搜索文章标题"
      />

      {articles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
          你还没有可编排的文章。先去创作中心写一篇，再回来加入系列。
        </p>
      ) : matched.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
          {`没有匹配「${query.trim()}」的文章。`}
        </p>
      ) : (
        <>
          {availableCount === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
              所有文章都已加入这个系列。
            </p>
          ) : null}
          <ul className="-mx-1 max-h-[min(26rem,55vh)] overflow-y-auto overscroll-contain px-1">
            {matched.map((article) => {
              const added = selectedIds.has(article.id);
              const state = articleDisplayState(article);
              const title = articleDisplayTitle(article.title);
              return (
                <li
                  key={article.id}
                  className="flex items-start gap-2 border-b border-border/50 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-foreground">{title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <ArticleStateBadge state={state} />
                      {added ? (
                        <span className="text-[11px] text-muted-foreground">已在系列中</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={added ? "outline" : "secondary"}
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={added}
                    aria-label={added ? `已添加：${title}` : `添加：${title}`}
                    onClick={() => onAdd(article)}
                  >
                    {added ? (
                      "已添加"
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        添加
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="border-t border-border/60 pt-2 text-[11px] leading-4 text-muted-foreground">
        草稿和审核中的文章可以先编排；加入系列不会改变文章的可见性。回收站文章不在此列表。
      </p>
    </section>
  );
}
