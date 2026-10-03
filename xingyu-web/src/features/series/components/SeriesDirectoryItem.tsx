import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { seriesStatusLabel } from "../series-labels";
import { SeriesCover } from "@/components/visual/SeriesCover";

function formatDirectoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function SeriesDirectoryItem({ item, index }: { item: PublicSeriesSummary; index: number }) {
  return (
    <li className="border-b border-border/60 last:border-0">
      <Link
        to={`/series/${encodeURIComponent(item.id)}`}
        className="group focus-ring grid grid-cols-[2.5rem_84px_minmax(0,1fr)_auto] items-center gap-4 py-4 transition-colors hover:bg-muted/35"
      >
        <span className="self-start pt-0.5 font-mono text-sm tabular-nums text-muted-foreground/70">
          {String(index + 1).padStart(2, "0")}
        </span>

        <SeriesCover stableKey={`${item.id}:${item.slug}`} title={item.title} variant="cover" />

        <span className="min-w-0">
          <span className="block text-[18px] font-semibold leading-6 text-primary transition-colors group-hover:text-accent">
            {item.title}
          </span>
          {item.description ? (
            <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted-foreground">
              {item.description}
            </span>
          ) : null}
          <span className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>{seriesStatusLabel(item.status)}</span>
            <span>{item.chapterCount} 篇文章</span>
            <span>{formatDirectoryDate(item.updatedAt)} 更新</span>
          </span>
        </span>

        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground/60 opacity-70 transition-[transform,opacity,color] group-hover:text-accent group-hover:opacity-100">
          <span className="hidden sm:inline">查看系列</span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </Link>
    </li>
  );
}
