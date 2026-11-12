import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Type } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

/*
 * ReaderFrame — the ONE reading layout for every content-reading page
 * (`/articles/:id`, `/guide/:slug`, `/announcements/:id`, and — via task-49 —
 * `/rules` and `/series/:id/read`). Source of the geometry: `.team/design/
 * C-reader.md` §1/§2, plus the 2026-11-10 user corrections (paper surface,
 * always-populated rails, real tools).
 *
 * THERE IS NO PER-CONTENT-TYPE LAYOUT. 文章 / 指南 / 公告 / 规则 / 系列章节
 * all render through this frame with the same tracks, the same block order
 * (tools → contents-or-info → progress) and the same typography. The only
 * permitted difference is a cover image above the body, and only when the
 * data actually has one.
 *
 * AXIS: R = 齐 — every block starts on ONE reading column; the two side tracks
 * fill the void that used to flank it. At 1910 the text column is still
 * 596.1–1313.9 and the two page margins are ≤240 each.
 *
 * Why the rails are a PAIR: the axis rule (§1) requires the two tracks to be
 * equal (`minmax(200px,1fr)` twice); a fixed + an auto track would push the
 * text off the viewport centre. Therefore one rail alone is not a track — when
 * either side is missing the frame degrades to the single centred column and
 * the (single) rail that was passed is rendered after the text instead of
 * disappearing.
 *
 * The rails only become tracks at ≥1440 (§2.4); below that the shell cannot
 * fit `718 + 64 + 200` without moving the text off centre, so 1024–1439 and
 * <1024 are one column. The `<aside>`s are still in the DOM at every width
 * (`hidden` = `display:none`), which is what lets the progress block and the
 * document info keep mounting on a phone. They are never empty rails: each
 * page passes at least one real block per side.
 *
 * `data-reader-track` is a pure acceptance hook (C-reader §8.2 measures the
 * three tracks by it) and must never be read by product logic.
 */

const RAIL_CLASS = cn(
  "hidden min-w-0 min-[1440px]:block",
  "lg:sticky lg:top-[calc(var(--shell-header-height)+1rem)] lg:self-start",
  "lg:max-h-[calc(100vh-var(--shell-header-height)-2rem)] lg:overflow-y-auto lg:overscroll-contain",
);

/** One track's worth of reading column. The width is the shared measure. */
const COLUMN_CLASS = "mx-auto w-full min-w-0 max-w-[var(--reading-measure)]";

export type ReaderFrameProps = {
  /** Metadata rail (author / series / tags / published). */
  asideLeft?: ReactNode;
  /** Landmark name for the left track. */
  asideLeftLabel?: string;
  /** Tools → contents/info → progress rail. */
  asideRight?: ReactNode;
  /** Landmark name for the right track. */
  asideRightLabel?: string;
  /** The reading column: header, body and tail. */
  children: ReactNode;
  className?: string;
};

export function ReaderFrame({
  asideLeft,
  asideLeftLabel = "阅读信息",
  asideRight,
  asideRightLabel = "阅读工具",
  children,
  className,
}: ReaderFrameProps) {
  const leftId = useId();
  const rightId = useId();

  /*
   * See "why the rails are a pair" above. Both or neither: a single rail in a
   * three-track grid would land the main column in the wrong track.
   */
  const hasRails = Boolean(asideLeft && asideRight);

  return (
    <>
      {/* One progress line per reading page, directly under the sticky header. */}
      <ReaderProgressLine />

      <div className={cn("mx-auto w-full max-w-[var(--reading-frame)]", className)}>
        {hasRails ? (
          <div className="grid grid-cols-1 gap-[64px] min-[1440px]:grid-cols-[minmax(200px,1fr)_var(--reading-measure)_minmax(200px,1fr)]">
            {/*
             * The 64px gutter is stated in px on purpose: at ≥1800 the root
             * font-size is 18px, so `gap-16` (4rem) would resolve to 72px and
             * the 1910 geometry would drift off the design's
             * `297 | 64 | 718 | 64 | 297`.
             */}
            <aside data-reader-track="left" aria-labelledby={leftId} className={RAIL_CLASS}>
              <h2 id={leftId} className="sr-only">
                {asideLeftLabel}
              </h2>
              {asideLeft}
            </aside>

            <div data-reader-track="main" className={COLUMN_CLASS}>
              {children}
            </div>

            <aside data-reader-track="right" aria-labelledby={rightId} className={RAIL_CLASS}>
              <h2 id={rightId} className="sr-only">
                {asideRightLabel}
              </h2>
              {asideRight}
            </aside>
          </div>
        ) : (
          <>
            <div data-reader-track="main" className={COLUMN_CLASS}>
              {children}
            </div>
            {asideLeft ? (
              <aside
                aria-label={asideLeftLabel}
                className="mx-auto mt-10 w-full min-w-0 max-w-[var(--reading-measure)]"
              >
                {asideLeft}
              </aside>
            ) : null}
            {asideRight ? (
              <aside
                aria-label={asideRightLabel}
                className="mx-auto mt-10 w-full min-w-0 max-w-[var(--reading-measure)]"
              >
                {asideRight}
              </aside>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

/* ===========================================================================
 * Scroll progress — ONE implementation for the whole product
 * ===========================================================================
 * C-reader §5 forbids duplicating this: the old `GuideReadingProgress`
 * (`fixed top-0 z-40`, painting over the header) and the series toolbar's
 * width-based bar were two copies of the same idea. This registry is the one
 * `scroll` listener: every progress visual subscribes to it and is painted
 * imperatively (no React re-render per frame). Only the integer percentage
 * reaches React state, and only when it changes.
 */
type ReaderProgressSink = (ratio: number, percent: number) => void;

const readerProgressSinks = new Set<ReaderProgressSink>();
let readerProgressFrame = 0;

function paintReaderProgress() {
  readerProgressFrame = 0;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
  const percent = Math.round(ratio * 100);
  for (const sink of readerProgressSinks) sink(ratio, percent);
}

function scheduleReaderProgress() {
  if (readerProgressFrame !== 0) return;
  readerProgressFrame = window.requestAnimationFrame(paintReaderProgress);
}

function subscribeReaderProgress(sink: ReaderProgressSink): () => void {
  readerProgressSinks.add(sink);
  if (readerProgressSinks.size === 1) {
    window.addEventListener("scroll", scheduleReaderProgress, { passive: true });
    window.addEventListener("resize", scheduleReaderProgress);
  }
  scheduleReaderProgress();
  return () => {
    readerProgressSinks.delete(sink);
    if (readerProgressSinks.size > 0) return;
    window.removeEventListener("scroll", scheduleReaderProgress);
    window.removeEventListener("resize", scheduleReaderProgress);
    if (readerProgressFrame !== 0) {
      window.cancelAnimationFrame(readerProgressFrame);
      readerProgressFrame = 0;
    }
  };
}

/*
 * The 2px line under the header (user correction 2026-11-10, point 7): thin,
 * `fixed`, `z-rail` so it can never paint over the `z-header` shell header.
 * The container keeps a 1px `--border` base colour, so `scaleX(0)` reads as an
 * empty track rather than as a missing element.
 */
function ReaderProgressLine() {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const percentRef = useRef(0);
  const [percent, setPercent] = useState(0);

  useEffect(
    () =>
      subscribeReaderProgress((ratio, next) => {
        const fill = fillRef.current;
        if (fill) fill.style.transform = `scaleX(${ratio})`;
        if (next !== percentRef.current) {
          percentRef.current = next;
          setPercent(next);
        }
      }),
    [],
  );

  return (
    <div
      role="progressbar"
      aria-label="阅读进度条"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="pointer-events-none fixed inset-x-0 top-[var(--shell-header-height)] z-rail h-0.5 bg-border"
    >
      <div
        ref={fillRef}
        aria-hidden
        className="h-full origin-left bg-accent"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/**
 * The "阅读进度" block (right track, always last): 4px track + integer percent.
 * Painted through the shared subscription above, so it never adds a second
 * `scroll` listener.
 */
export function ReaderProgress({
  label = "阅读进度",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const percentRef = useRef(0);
  const [percent, setPercent] = useState(0);

  useEffect(
    () =>
      subscribeReaderProgress((ratio, next) => {
        const fill = fillRef.current;
        if (fill) fill.style.transform = `scaleX(${ratio})`;
        if (next !== percentRef.current) {
          percentRef.current = next;
          setPercent(next);
        }
      }),
    [],
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">阅读进度</p>
        <span className="text-meta tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          ref={fillRef}
          aria-hidden
          className="h-full origin-left rounded-full bg-accent"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
}

/* ===========================================================================
 * Reading tools — real font-size / line-height controls
 * ===========================================================================
 * The user's correction made the tools REAL: A−/A+ changes the body size and
 * the three line-height steps change the leading. Every content-reading page
 * passes both; the guide page passes font size only.
 *
 * `size="touch"` is the mobile sheet variant (every target ≥44×44); the
 * default is the compact desktop rail (36×36 inside a 40px row).
 */
export type ReaderLineHeightStep = { value: number; label: string };

/*
 * ONE shared reading-settings ladder for every content-reading page.
 *
 * 16 / 18 / 20 (default 18) and 紧 / 标准 / 宽 (default 1.9) — the numbers the
 * user correction specified. The guide page used to have its own `[17,19,21]`
 * ladder; that is now this one, and `/series` keeps its persisted ladder only
 * because `reader-preferences` validates it (task-49).
 */
export const READER_FONT_SIZES = [16, 18, 20] as const;
export const READER_DEFAULT_FONT_SIZE = 18;
export const READER_LINE_HEIGHT_STEPS = [
  { value: 1.8, label: "紧" },
  { value: 1.9, label: "标准" },
  { value: 2, label: "宽" },
] as const satisfies readonly ReaderLineHeightStep[];
export const READER_DEFAULT_LINE_HEIGHT = 1.9;

const READER_TOOL_BUTTON =
  "focus-ring grid shrink-0 place-items-center rounded-md border border-border text-meta font-medium text-foreground-soft transition-colors hover:border-accent-line hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-40";

function stepFontSize(current: number, steps: readonly number[], direction: -1 | 1): number {
  const index = steps.indexOf(current);
  if (index < 0) return steps[0] ?? current;
  const next = index + direction;
  if (next < 0) return steps[0] ?? current;
  if (next >= steps.length) return steps[steps.length - 1] ?? current;
  return steps[next] ?? current;
}

export type ReaderToolsProps = {
  fontSize: number;
  /** Ascending ladder, e.g. `[16, 18, 20]`. */
  fontSizeSteps: readonly number[];
  onFontSize: (fontSize: number) => void;
  /** Omit both line-height props to render the font-size control alone. */
  lineHeight?: number;
  lineHeightSteps?: readonly ReaderLineHeightStep[];
  onLineHeight?: (lineHeight: number) => void;
  size?: "default" | "touch";
  className?: string;
};

export function ReaderTools({
  fontSize,
  fontSizeSteps,
  onFontSize,
  lineHeight,
  lineHeightSteps,
  onLineHeight,
  size = "default",
  className,
}: ReaderToolsProps) {
  const button = cn(READER_TOOL_BUTTON, size === "touch" ? "h-11 w-11" : "h-9 w-9");
  const stepButton = cn(
    "focus-ring rounded-md border transition-colors",
    size === "touch" ? "h-11 px-3 text-sm" : "h-9 px-2.5 text-meta",
    "hover:bg-muted/50",
  );

  return (
    <div role="group" aria-label="阅读工具" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-meta text-muted-foreground">字号</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="减小字号"
            disabled={fontSize <= (fontSizeSteps[0] ?? fontSize)}
            onClick={() => onFontSize(stepFontSize(fontSize, fontSizeSteps, -1))}
            className={button}
          >
            A−
          </button>
          <span
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "text-center text-meta tabular-nums text-muted-foreground",
              size === "touch" ? "w-9" : "w-7",
            )}
          >
            <span className="sr-only">当前字号 </span>
            {fontSize}
          </span>
          <button
            type="button"
            aria-label="增大字号"
            disabled={fontSize >= (fontSizeSteps[fontSizeSteps.length - 1] ?? fontSize)}
            onClick={() => onFontSize(stepFontSize(fontSize, fontSizeSteps, 1))}
            className={button}
          >
            A+
          </button>
        </div>
      </div>

      {lineHeight !== undefined && lineHeightSteps && onLineHeight ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-meta text-muted-foreground">行距</span>
          <div role="group" aria-label="行距" className="flex items-center gap-1">
            {lineHeightSteps.map((step) => (
              <button
                key={step.value}
                type="button"
                aria-pressed={lineHeight === step.value}
                onClick={() => onLineHeight(step.value)}
                className={cn(
                  stepButton,
                  lineHeight === step.value
                    ? "border-accent-line bg-accent-soft font-medium text-accent-strong"
                    : "border-border text-muted-foreground",
                )}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===========================================================================
 * Document stats — "本文共 N 段 · 约 M 字", derived from the real body
 * ===========================================================================
 * Replaces the table of contents when an article has no h2/h3. Both numbers
 * are computed from the rendered Markdown — no API field is invented (the
 * backend has no word count), and no character is estimated client-side from
 * the title or the summary.
 */
export type ReaderDocumentStats = { paragraphs: number; characters: number };

const MARKDOWN_HEADING = /^\s*#{1,6}\s/;
const MARKDOWN_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const MARKDOWN_IMAGE = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;
const MARKDOWN_FENCE = /^\s*```/;

export function readerDocumentStats(body: string): ReaderDocumentStats {
  const characters = body.replace(/\s/g, "").length;
  let paragraphs = 0;
  for (const block of body.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    /* A heading / rule / lone image / code fence is not a paragraph of prose. */
    if (
      MARKDOWN_HEADING.test(trimmed) ||
      MARKDOWN_HR.test(trimmed) ||
      MARKDOWN_IMAGE.test(trimmed) ||
      MARKDOWN_FENCE.test(trimmed)
    ) {
      continue;
    }
    paragraphs += 1;
  }
  return { paragraphs, characters };
}

export function ReaderDocInfo({ body, className }: { body: string; className?: string }) {
  const stats = useMemo(() => readerDocumentStats(body), [body]);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow mb-3">本文信息</p>
      <p className="text-meta tabular-nums text-muted-foreground">
        本文共 {stats.paragraphs} 段 · 约 {stats.characters} 字
      </p>
    </div>
  );
}

/* ===========================================================================
 * The <1440 reading-settings trigger — one component for every content page
 * ===========================================================================
 * At ≥1440 the controls are the first block of the right track. Below that
 * they are this 44×44 trigger + the bottom Sheet:
 *
 *   <1024      at the top-right of the title block;
 *   1024–1439  fixed to the reading column's top-right corner (the frame
 *              renders no tracks in that band).
 *
 * The sheet reuses `ReaderTools` (`size="touch"`), so the ladder, the bounds
 * and the accessible names exist once for the whole product.
 */
export function ReaderSettingsButton({
  fontSize,
  onFontSize,
  lineHeight,
  onLineHeight,
  className,
}: {
  fontSize: number;
  onFontSize: (fontSize: number) => void;
  lineHeight: number;
  onLineHeight: (lineHeight: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="阅读设置"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={cn(
            "focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground-soft transition-colors hover:border-accent-line hover:text-accent-strong",
            className,
          )}
        >
          <Type aria-hidden className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        id={panelId}
        side="bottom"
        className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-3 pr-14 pt-4 text-left">
          <SheetTitle className="text-base font-semibold text-primary">阅读设置</SheetTitle>
          <SheetDescription className="text-meta text-muted-foreground">
            字号与行距只影响本页正文，不会保存到账户。
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-5">
          <ReaderTools
            size="touch"
            fontSize={fontSize}
            fontSizeSteps={READER_FONT_SIZES}
            onFontSize={onFontSize}
            lineHeight={lineHeight}
            lineHeightSteps={READER_LINE_HEIGHT_STEPS}
            onLineHeight={onLineHeight}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ===========================================================================
 * Left-track source block — the same object on every content page
 * ===========================================================================
 * "关于这份内容": source/author identity (avatar 40, or the name's first
 * character), the publish date and the derived facts (words / paragraphs /
 * steps). Every row is a real fact computed from the page's own data — the
 * block never invents a field to look fuller.
 */
export type ReaderSourceRow = { label: string; value: ReactNode };

export function ReaderSourceCard({
  name,
  handle,
  avatarUrl,
  href,
  rows = [],
  className,
}: {
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  /** In-app link to the author/source page. Omit for the official source. */
  href?: string;
  rows?: readonly ReaderSourceRow[];
  className?: string;
}) {
  const avatar = avatarUrl ? (
    <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm"
    >
      {name.slice(0, 1)}
    </span>
  );

  const identity = (
    <span className="min-w-0">
      <span className="block truncate font-medium text-foreground transition-colors group-hover:text-accent-strong">
        {name}
      </span>
      {handle ? (
        <span className="block truncate text-[13px] text-muted-foreground">@{handle}</span>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-card border border-border bg-card p-4 text-meta",
        className,
      )}
    >
      <p className="eyebrow">关于这份内容</p>
      {href ? (
        <Link to={href} className="group focus-ring flex min-w-0 items-center gap-3 rounded-sm">
          {avatar}
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          {identity}
        </div>
      )}
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 truncate text-right tabular-nums text-foreground-soft">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
