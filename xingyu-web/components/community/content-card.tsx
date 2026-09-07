import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, Eye, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ContentCardProps = {
  href: string;
  title: string;
  summary?: string;
  eyebrow?: string;
  author?: string;
  meta?: string;
  variant?: "feature" | "standard" | "compact";
  tone?: "night" | "dawn" | "mist" | "violet";
  stats?: { views?: string; likes?: string; comments?: string };
};

const toneClass: Record<NonNullable<ContentCardProps["tone"]>, string> = {
  night: "from-[#11295d] via-[#253d87] to-[#080f2d] text-white",
  dawn: "from-[#f2c18e] via-[#d98463] to-[#6e506d] text-white",
  mist: "from-[#e6ecfb] via-[#c5d1ed] to-[#8091bf] text-[#17234e]",
  violet: "from-[#656ea9] via-[#53578d] to-[#303967] text-white",
};

export function ContentCard({
  href,
  title,
  summary,
  eyebrow,
  author,
  meta,
  variant = "standard",
  tone = "mist",
  stats,
}: ContentCardProps) {
  const isFeature = variant === "feature";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex overflow-hidden rounded-xl border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[rgb(var(--violet)/0.45)] hover:shadow-[0_14px_32px_rgba(19,35,77,0.11)] focus-visible:outline-none",
        isFeature ? "min-h-64 p-6 sm:p-7" : variant === "compact" ? "min-h-28 p-4" : "min-h-44 p-5"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", toneClass[tone])} aria-hidden="true" />
      <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(circle_at_80%_18%,rgba(255,255,255,.9)_0_1px,transparent_1.5px),radial-gradient(ellipse_at_73%_54%,transparent_0_38%,rgba(255,255,255,.36)_38.4%_39%,transparent_39.4%)] [background-size:18px_18px,100%_100%]" aria-hidden="true" />
      <div className="relative flex w-full flex-col justify-between">
        <div>
          {eyebrow && <p className="text-xs font-semibold tracking-[0.08em] opacity-80">{eyebrow}</p>}
          <h3 className={cn("mt-2 font-semibold tracking-[-0.02em]", isFeature ? "max-w-xl text-2xl sm:text-3xl" : "text-lg")}>
            {title}
          </h3>
          {summary && <p className={cn("mt-3 max-w-xl text-sm leading-6 opacity-85", variant === "compact" && "line-clamp-2")}>{summary}</p>}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs opacity-90">
          {author && <span>{author}</span>}
          {meta && <span>{meta}</span>}
          <span className="ml-auto inline-flex items-center gap-1 font-medium">
            阅读 <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        {stats && (
          <div className="mt-3 flex gap-3 text-xs opacity-85">
            {stats.views && <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{stats.views}</span>}
            {stats.likes && <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{stats.likes}</span>}
            {stats.comments && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{stats.comments}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

export function ContentRow({ href, title, summary, meta, tone = "night" }: Omit<ContentCardProps, "variant" | "eyebrow" | "author" | "stats">) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-card focus-visible:outline-none">
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br", toneClass[tone])} aria-hidden="true">
        <BookOpen className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{title}</span>
        {summary && <span className="mt-1 block truncate text-sm text-muted-foreground">{summary}</span>}
      </span>
      {meta && <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex"><Clock3 className="h-3.5 w-3.5" />{meta}</span>}
    </Link>
  );
}
