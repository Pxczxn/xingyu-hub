import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TopicsHero({
  keyword,
  onKeywordChange,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
}) {
  return (
    <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">TOPICS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary">话题广场</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          从感兴趣的话题出发，找到正在发生的讨论。
        </p>
      </div>
      <div className="relative w-80 shrink-0">
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
