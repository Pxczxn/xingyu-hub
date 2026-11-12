import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { ApiError } from "@/api/client";
import { ArticleOutline } from "@/features/article/components/ArticleOutline";
import {
  READER_DEFAULT_FONT_SIZE,
  READER_DEFAULT_LINE_HEIGHT,
  READER_FONT_SIZES,
  READER_LINE_HEIGHT_STEPS,
  ReaderDocInfo,
  ReaderFrame,
  ReaderProgress,
  ReaderSettingsButton,
  ReaderSourceCard,
  ReaderTools,
  readerDocumentStats,
} from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import type { ArticleOutlineItem } from "@/lib/article-markdown";
import { GuidePager, GuideTutorialBody } from "@/features/guide/components/GuideTutorial";
import { adjacentGuides } from "@/features/guide/guide-catalog";
import {
  guideReadingMinutes,
  segmentGuideDocument,
  type GuideSegment,
} from "@/features/guide/guide-steps";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; page: GuidePage };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

export function GuideDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    guideApi
      .getBySlug(slug)
      .then((page) => {
        if (active) setState({ kind: "ready", page });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <BackToGuide />
        </p>
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="指南不存在或未发布"
          description="这篇指南可能已下线，或地址有误。"
        />
        <BackToGuide />
      </div>
    );
  }

  const { page } = state;
  return <GuideReading page={page} />;
}

function GuideReading({ page }: { page: GuidePage }) {
  const guideDocument = useMemo(
    () => segmentGuideDocument({ blocks: page.blocks, body: page.body }),
    [page],
  );
  const outline = useMemo(() => guideHeadingOutline(guideDocument.segments), [guideDocument]);
  const stats = useMemo(() => readerDocumentStats(page.body), [page.body]);
  const { previous, next } = adjacentGuides(page.slug);
  /* Local reading settings — the SAME ladder and defaults as every other
     content-reading page; nothing is persisted here. */
  const [fontSize, setFontSize] = useState(READER_DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(READER_DEFAULT_LINE_HEIGHT);
  const minutes = guideReadingMinutes(page.body);
  const stepCount = guideDocument.steps.length;

  /*
   * 内容阅读页（指南）— 与 /articles/:id、/announcements/:id 共用同一个
   * `ReaderFrame` 模板（用户 2026-11-10 口径：不再按内容类型分叉版式）。
   *
   *   左栏  「关于这份内容」实体块：来源（星语官方）、发布日期、阅读时长、
   *         字数 / 段落 / 步骤数 —— 全部由本页已有字段派生。
   *   右栏  块序固定：工具（A−/A+ + 行距 3 档，真实生效）→ 本文信息
   *         （有 h2/h3 时是目录，否则「共 N 段 · 约 M 字」）→ 进度。
   *   纸面  正文列包 `rounded-card border bg-card`，内边距 48×56（<1024 收 24）。
   *   标题  breadcrumb → eyebrow → h1 44/700/1.15 → meta（来源 · 日期 · 字数）
   *         → 1px 发丝线 → 48px → 正文；只有封面数据存在时才多一条头图，
   *         本页没有该数据，所以没有。
   *   底部  「上一篇 / 下一篇」是 SK6 行式列表，不是两张卡片。
   *   移动端 左右栏折叠成标题下的 meta 行 + 右上角 44×44 工具按钮 + 底部 Sheet。
   *
   * 行为未变：api、三态、404、目录锚点、`useParams`、翻页数据全部原样保留。
   */
  return (
    <>
      <ReaderFrame
        asideLeftLabel="关于这份内容"
        asideLeft={
          <ReaderSourceCard
            name="星语官方"
            rows={[
              ...(page.publishedAt
                ? [
                    {
                      label: "发布",
                      value: (
                        <time dateTime={page.publishedAt}>
                          {formatPublishedAt(page.publishedAt)}
                        </time>
                      ),
                    },
                  ]
                : []),
              { label: "阅读时长", value: `约 ${minutes} 分钟` },
              { label: "字数", value: `约 ${stats.characters} 字` },
              { label: "段落", value: `${stats.paragraphs} 段` },
              ...(stepCount > 0 ? [{ label: "步骤", value: `${stepCount} 个` }] : []),
            ]}
          />
        }
        asideRightLabel="阅读工具与内容信息"
        asideRight={
          <div className="flex flex-col gap-6">
            <ReaderTools
              fontSize={fontSize}
              fontSizeSteps={READER_FONT_SIZES}
              onFontSize={setFontSize}
              lineHeight={lineHeight}
              lineHeightSteps={READER_LINE_HEIGHT_STEPS}
              onLineHeight={setLineHeight}
            />
            {outline.length > 0 ? (
              <ArticleOutline items={outline} label="指南目录" rail />
            ) : (
              <ReaderDocInfo body={page.body} />
            )}
            <ReaderProgress />
          </div>
        }
      >
        <div className="rounded-card border border-border bg-card p-6 min-[1024px]:px-14 min-[1024px]:py-12">
          <article className="w-full max-w-[var(--reading-measure)]">
            <nav
              aria-label="指南路径"
              className="mb-3 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground"
            >
              <Link
                to="/guide"
                className="focus-ring rounded-sm transition-colors hover:text-accent-strong"
              >
                指南
              </Link>
              <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-border" />
              <span className="min-w-0 truncate">{page.title}</span>
            </nav>

            <header>
              <div className="flex items-start justify-between gap-4">
                <p className="eyebrow">指南</p>
                {/* <1024：44×44 阅读设置按钮在标题区右上角。 */}
                <ReaderSettingsButton
                  fontSize={fontSize}
                  onFontSize={setFontSize}
                  lineHeight={lineHeight}
                  onLineHeight={setLineHeight}
                  className="min-[1024px]:hidden"
                />
              </div>
              <h1 className="mt-3 text-[44px] font-bold leading-[1.15] tracking-tight text-primary">
                {page.title}
              </h1>
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
                <span className="font-medium text-foreground-soft">星语官方</span>
                {page.publishedAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={page.publishedAt} className="tabular-nums">
                      {formatPublishedAt(page.publishedAt)}
                    </time>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                <span className="tabular-nums">约 {stats.characters} 字</span>
              </p>
              {/* 1px 发丝线：宽 = 正文列。 */}
              <div aria-hidden className="mt-6 border-b border-border" />
            </header>

            <div className="mt-12">
              <GuideTutorialBody
                segments={guideDocument.segments}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            </div>

            {previous || next ? (
              <footer className="mt-12 border-t border-border pt-8">
                <GuidePager previous={previous} next={next} />
              </footer>
            ) : null}
          </article>
        </div>
      </ReaderFrame>

      {/*
        1024–1439: the frame renders no rails in this band, so the trigger is
        pinned to the reading column's top-right corner (383 = half the measure
        + 24) — same rule as every other content-reading page.
      */}
      <div className="fixed left-[calc(50%+383px)] top-[calc(var(--shell-header-height)+16px)] z-rail hidden min-[1024px]:grid min-[1440px]:hidden">
        <ReaderSettingsButton
          fontSize={fontSize}
          onFontSize={setFontSize}
          lineHeight={lineHeight}
          onLineHeight={setLineHeight}
        />
      </div>
    </>
  );
}

function guideHeadingOutline(segments: GuideSegment[]): ArticleOutlineItem[] {
  const items: ArticleOutlineItem[] = [];
  for (const segment of segments) {
    if (segment.kind !== "heading" || !segment.id) continue;
    const level: ArticleOutlineItem["level"] = segment.level >= 4 ? 4 : segment.level >= 3 ? 3 : 2;
    items.push({ id: segment.id, text: segment.text, level });
  }
  return items;
}

function BackToGuide() {
  return (
    <Link to="/guide" className="text-sm text-accent-strong hover:underline">
      返回指南目录
    </Link>
  );
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
