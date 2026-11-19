import { useId, useRef, useState } from "react";
import { List } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { ArticleOutlineItem } from "@/lib/article-markdown";
import { ArticleOutline } from "./ArticleOutline";

/*
 * Compact (<1440) table-of-contents trigger for article / guide / rules.
 *
 * The right rail already hosts `ArticleOutline` at ≥1440. Below that the rails
 * are `display:none`, so this 44×44 control opens the same outline inside the
 * series-verified left Sheet (focus trap, background scroll lock, Escape,
 * preventScroll focus return). It is not the series `ChapterList`.
 */
export function ReaderOutlineButton({
  items,
  label = "文章目录",
  className,
}: {
  items: readonly ArticleOutlineItem[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  if (items.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="目录"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={cn(
            "focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground-soft transition-colors hover:border-accent-line hover:text-accent-strong",
            className,
          )}
        >
          <List aria-hidden className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        id={panelId}
        side="left"
        className="flex w-[86vw] max-w-sm flex-col gap-0 overflow-x-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-3 pr-14 pt-4 text-left">
          <SheetTitle className="text-primary">目录</SheetTitle>
          <SheetDescription className="text-meta text-muted-foreground">{label}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 pb-[env(safe-area-inset-bottom)]">
          <ArticleOutline
            items={[...items]}
            label={label}
            rail
            hideEyebrow
            onItemSelect={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
