import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { ApiError } from "@/api/client";
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

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; item: Announcement };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

export function AnnouncementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  /* Same local reading settings as every content-reading page. */
  const [fontSize, setFontSize] = useState(READER_DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(READER_DEFAULT_LINE_HEIGHT);

  useEffect(() => {
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    announcementsApi
      .getById(id)
      .then((item) => {
        if (active) setState({ kind: "ready", item });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

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
          <BackToList />
        </p>
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="公告不存在或未发布"
          description="这条公告可能已归档，或地址有误。"
        />
        <BackToList />
      </div>
    );
  }

  const { item } = state;
  const stats = readerDocumentStats(item.body ?? "");

  /*
   * 内容阅读页（公告）— 与 /articles/:id、/guide/:slug 共用同一个 `ReaderFrame`
   * 模板（用户 2026-11-10 口径：所有看内容的页面一个版式）。
   *
   *   左栏  「关于这份内容」：来源（星语官方）、发布日期、字数 / 段落。
   *   右栏  块序固定：工具（A−/A+ + 行距，真实生效）→ 本文信息（公告没有
   *         h2/h3，所以是「共 N 段 · 约 M 字」）→ 进度。
   *   纸面  正文列包 `rounded-card border bg-card`，内边距 48×56（<1024 收 24）。
   *   标题  eyebrow → h1 44/700/1.15 → meta（来源 · 日期 · 字数）→ 1px 发丝线
   *         → 48px → 正文。公告没有封面数据，所以没有头图。
   *   移动端 左右栏折叠成 meta 行 + 右上角 44×44 工具按钮 + 底部 Sheet。
   *
   * 行为未变：加载 / 错误 / 404（`ARCHIVED`、`NOT_FOUND` 都走 notfound）三态、
   * 重试、正文纯文本渲染（`whitespace-pre-wrap`，不解析 HTML）、返回列表链接
   * 全部原样。
   */
  return (
    <article>
      <ReaderFrame
        asideLeftLabel="关于这份内容"
        asideLeft={
          <ReaderSourceCard
            name="星语官方"
            rows={[
              ...(item.publishedAt
                ? [
                    {
                      label: "发布",
                      value: (
                        <time dateTime={item.publishedAt}>
                          {formatPublishedAt(item.publishedAt)}
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
            <ReaderDocInfo body={item.body ?? ""} />
            <ReaderProgress />
          </div>
        }
      >
        <div className="rounded-card border border-border bg-card p-6 min-[1024px]:px-14 min-[1024px]:py-12">
          <header>
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow">站务公告</p>
              <div className="flex items-center gap-3">
                <BackToList />
                {/* <1024：44×44 阅读设置按钮在标题区右上角。 */}
                <ReaderSettingsButton
                  fontSize={fontSize}
                  onFontSize={setFontSize}
                  lineHeight={lineHeight}
                  onLineHeight={setLineHeight}
                  className="min-[1024px]:hidden"
                />
              </div>
            </div>
            <h1 className="mt-3 text-[44px] font-bold leading-[1.15] tracking-tight text-primary">
              {item.title}
            </h1>
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
              <span className="font-medium text-foreground-soft">星语官方</span>
              {item.publishedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={item.publishedAt} className="tabular-nums">
                    {formatPublishedAt(item.publishedAt)}
                  </time>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="tabular-nums">约 {stats.characters} 字</span>
            </p>
            {/* 1px 发丝线：宽 = 正文列。 */}
            <div aria-hidden className="mt-6 border-b border-border" />
          </header>

          {/*
            公告正文是纯文本（后端存的是纯文本，HTML 不解析），所以保留
            `whitespace-pre-wrap`。字号/行距由本地阅读设置控制，默认 18px / 1.9。
          */}
          <div
            className="mt-12 max-w-[var(--reading-measure)] whitespace-pre-wrap text-foreground"
            style={{ fontSize, lineHeight }}
          >
            {item.body || "该公告暂未提供正文。"}
          </div>
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
    </article>
  );
}

function BackToList() {
  return (
    <Link to="/announcements" className="focus-ring text-sm text-accent-strong hover:underline">
      返回公告列表
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
