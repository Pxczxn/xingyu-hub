import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TopicsHero({
  keyword,
  onKeywordChange,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
}) {
  /*
   * Stacked below `sm`, side-by-side above it.
   *
   * 2026-10-03: the search box was `w-80 shrink-0` — a fixed 320px that could not
   * shrink. Next to the title block (plus `gap-8`) that needs ~470px before the
   * box even starts, so at 390px — the width of an iPhone 12/13/14, not an exotic
   * device — the page scrolled sideways by 52px. A reader on a phone cannot fix
   * that by resizing.
   *
   * Full-width when stacked is also simply better here: a search field is the one
   * thing on this page worth the whole line.
   */
  return (
    <header className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">TOPICS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary">话题广场</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          从感兴趣的话题出发，找到正在发生的讨论。
        </p>
      </div>
      <div className="relative w-full sm:w-80 sm:shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索话题"
          aria-label="搜索话题"
          className="pl-9"
        />
      </div>
    </header>
  );
}
