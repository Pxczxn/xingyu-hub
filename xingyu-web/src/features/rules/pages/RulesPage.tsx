import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import { guideOutline } from "@/api/guide/guide.types";
import type { GuidePage } from "@/api/guide/guide.types";
import { ArticleOutline } from "@/features/article/components/ArticleOutline";
import { GuideTutorialBody } from "@/features/guide/components/GuideTutorial";
import { segmentGuideDocument } from "@/features/guide/guide-steps";
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

type LoadState = { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; page: GuidePage };

/*
 * 内容阅读页（规则）— `/rules`。
 *
 * 与 `/articles/:id`、`/guide/:slug`、`/announcements/:id`、`/series/:id/read`
 * 共用同一个 `ReaderFrame` 模板（用户 2026-11-10 口径：不按内容类型分叉版式，
 * 都是看内容的地方，公用的）。
 *
 *   栏位   三轨 `[元信息 | 正文 | 工具/目录/进度]`；1910 下正文列仍是
 *          `--reading-measure`（596.1–1313.9），两侧栏各 297、栏距 64。
 *   纸面   正文列包 `rounded-card border bg-card`，内边距 48×56（<1024 收 24）。
 *   左栏   「关于这份内容」：来源（星语官方）、最后更新日期、字数 / 段落 ——
 *          全部由本页已有字段派生，没有日期就不放那一行。
 *   右栏   块序固定：工具（A−/A+ 16/18/20 + 行距 3 档，真实生效）→ 本文信息
 *          （有标题块时是目录，没有时是「本文共 N 段 · 约 M 字」）→ 进度。
 *   标题   eyebrow → h1 44/700/1.15 → meta（来源 · 最后更新 · 约 N 字）→
 *          1px 发丝线 → 48px → 正文。本页没有封面数据，所以没有头图。
 *   正文   与 `/guide/:slug` 同一个渲染器（`GuideTutorialBody`）：段距 1.15em、
 *          连续编号/项目行合并成真正的 `<ol>/<ul>`、h2 28/600 上 48 下 16、
 *          引用 3px 左竖线、代码块浅灰底。
 *   移动端 左右栏折叠成标题下的 meta 行 + 右上角 44×44 工具按钮 + 底部 Sheet。
 *
 * 行为未变：api、加载 / 404 / 错误三态、重试、`GuidePage` 契约、正文回退到
 * 纯文本 `body`（没有 `blocks` 时）全部原样保留；换掉的只有呈现层与本页的
 * 本地字号/行距设置（默认 18 / 1.9，与全站内容阅读页一致，不写 storage）。
 */
export function RulesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    guideApi
      .getCommunityRules()
      .then((page) => {
        if (active) setState({ kind: "ready", page });
      })
      .catch(() => {
        if (active) setState({ kind: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "unavailable") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="社区规则暂不可用"
          description="请稍后重试，或先查看使用指南。"
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <Link to="/guide" className="text-sm text-accent-strong hover:underline">
            查看使用指南
          </Link>
        </p>
      </div>
    );
  }

  return <RulesReading page={state.page} />;
}

function RulesReading({ page }: { page: GuidePage }) {
  const rulesDocument = useMemo(
    () => segmentGuideDocument({ blocks: page.blocks, body: page.body }),
    [page],
  );
  /* The index comes from the server's heading blocks only. A document authored
     without `## ` markers has no headings, so no index is shown at all — a
     fabricated table of contents is exactly what this page must not do. */
  const outline = useMemo<ArticleOutlineItem[]>(
    () =>
      guideOutline(page.blocks).map((block) => ({
        id: block.id ?? "",
        text: block.text,
        level: block.level >= 3 ? 3 : 2,
      })),
    [page.blocks],
  );
  /* Real numbers from the document body: the backend has no word count, so the
     right rail's fallback and the header's "约 N 字" are computed here. */
  const stats = useMemo(() => readerDocumentStats(page.body), [page.body]);
  /* Local reading settings — the SAME ladder and defaults as every content
     reading page. Nothing is persisted: the rules page is checked, not read
     cover to cover, and the shared defaults are 18 / 1.9. */
  const [fontSize, setFontSize] = useState(READER_DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(READER_DEFAULT_LINE_HEIGHT);

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
                      label: "更新",
                      value: (
                        <time dateTime={page.publishedAt}>
                          {formatPublishedAt(page.publishedAt)}
                        </time>
                      ),
                    },
                  ]
                : []),
              { label: "字数", value: `约 ${stats.characters} 字` },
              { label: "段落", value: `${stats.paragraphs} 段` },
            ]}
          />
        }
        asideRightLabel="阅读工具与本文信息"
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
              <ArticleOutline items={outline} label="规则目录" rail />
            ) : (
              <ReaderDocInfo body={page.body} />
            )}
            <ReaderProgress />
          </div>
        }
      >
        <div className="rounded-card border border-border bg-card p-6 min-[1024px]:px-14 min-[1024px]:py-12">
          <article className="w-full max-w-[var(--reading-measure)]">
            <header>
              <div className="flex items-start justify-between gap-4">
                <p className="eyebrow">规则</p>
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
                    <span>
                      最后更新于{" "}
                      <time dateTime={page.publishedAt} className="tabular-nums">
                        {formatPublishedAt(page.publishedAt)}
                      </time>
                    </span>
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
                segments={rulesDocument.segments}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            </div>

            {/* 规则页唯一的交叉入口：看完条款去哪里。行式，不做第二个导航块。 */}
            <footer className="mt-12 border-t border-border pt-8">
              <Link
                to="/guide"
                className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent-strong transition-colors hover:underline"
              >
                查看使用指南
              </Link>
            </footer>
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
