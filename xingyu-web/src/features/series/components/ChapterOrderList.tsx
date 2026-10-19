import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { articleDisplayState, articleDisplayTitle } from "../series-labels";
import type { ChapterEntry } from "../series-order";
import { ArticleStateBadge } from "./SeriesStatusBadge";

type ChapterOrderListProps = {
  chapters: ChapterEntry[];
  articleById: Map<string, MyArticleSummary>;
  onMove: (articleId: string, delta: number) => void;
  onRemove: (articleId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

/**
 * Sortable chapter list (Phase 5C).
 *
 * Drag-and-drop is the fast path; up/down buttons stay as the reliable path for
 * keyboard, touch and assistive technology. dnd-kit's KeyboardSensor also works
 * on the handle (Space to lift, arrows to move, Space to drop), and the list is
 * announced in Chinese through `accessibility`.
 *
 * The drag handle is a separate button, so dragging a row can never navigate:
 * there is no row-level link or click handler at all.
 */
export function ChapterOrderList({
  chapters,
  articleById,
  onMove,
  onRemove,
  onReorder,
}: ChapterOrderListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    /* A short press-and-hold keeps a vertical swipe as scrolling, not a drag. */
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const positionOf = (id: string | number) =>
    chapters.findIndex((chapter) => chapter.articleId === String(id)) + 1;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "按空格键拿起章节，使用方向键移动，再按空格键放下；按 Esc 取消。也可以使用每行的上移、下移按钮。",
        },
        announcements: {
          onDragStart: ({ active }) => `已拿起第 ${positionOf(active.id)} 章`,
          onDragOver: ({ active, over }) =>
            over ? `第 ${positionOf(active.id)} 章移动到第 ${positionOf(over.id)} 章` : undefined,
          onDragEnd: ({ active, over }) =>
            over ? `已放到第 ${positionOf(over.id)} 章` : `第 ${positionOf(active.id)} 章未移动`,
          onDragCancel: ({ active }) => `已取消，第 ${positionOf(active.id)} 章留在原位`,
        },
      }}
    >
      <SortableContext
        items={chapters.map((chapter) => chapter.articleId)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="grid gap-2" data-testid="chapter-list">
          {chapters.map((chapter, index) => (
            <SortableChapterRow
              key={chapter.articleId}
              chapter={chapter}
              index={index}
              total={chapters.length}
              article={articleById.get(chapter.articleId)}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableChapterRow({
  chapter,
  index,
  total,
  article,
  onMove,
  onRemove,
}: {
  chapter: ChapterEntry;
  index: number;
  total: number;
  article: MyArticleSummary | undefined;
  onMove: (articleId: string, delta: number) => void;
  onRemove: (articleId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.articleId });
  const title = articleDisplayTitle(chapter.title ?? article?.title ?? null);
  const state = articleDisplayState(article);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-chapter-id={chapter.articleId}
      className={cn(
        "grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-2 rounded-lg border border-border/70 bg-card p-2.5 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:p-3",
        isDragging &&
          "relative z-10 border-accent-line opacity-90 shadow-lg ring-2 ring-accent-line",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`拖动排序：${title}`}
        className="focus-ring mt-0.5 grid h-8 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <span
        aria-hidden
        className="mt-1.5 w-6 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0 pt-0.5">
        <p className="break-words text-sm font-medium text-foreground">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ArticleStateBadge state={state} />
          {state.hint ? (
            <span className="text-[11px] leading-4 text-muted-foreground">{state.hint}</span>
          ) : null}
        </div>
      </div>

      <div className="col-span-3 flex items-center justify-end gap-1 sm:col-span-1 sm:col-start-4 sm:items-start">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={index === 0}
          aria-label={`上移：${title}`}
          onClick={() => onMove(chapter.articleId, -1)}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          上移
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={index === total - 1}
          aria-label={`下移：${title}`}
          onClick={() => onMove(chapter.articleId, 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          下移
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`移除：${title}`}
          onClick={() => onRemove(chapter.articleId)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          移除
        </Button>
      </div>
    </li>
  );
}
