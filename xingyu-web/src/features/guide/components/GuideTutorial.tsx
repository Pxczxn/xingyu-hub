import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GuideCatalogEntry } from "@/features/guide/guide-catalog";
import type { GuideSegment, GuideStep } from "@/features/guide/guide-steps";
import { FeedRow, READER_DEFAULT_FONT_SIZE, READER_DEFAULT_LINE_HEIGHT } from "@/components/layout";

/*
 * Guide prose — rendered inside the shared 内容阅读页 column.
 *
 * The locals below are the content typography the 2026-11-10 user correction
 * specified: 1.15em between paragraphs, 1.9 leading, h2 28/600 (48 above, 16
 * below), real `<ol>`/`<ul>` for consecutive numbered/bulleted lines with 8px
 * between items and a 1.5em indent.
 *
 * They are inline styles, not globals: `globals.css` is outside this batch's
 * scope and its `.guide-reader.article-body` rules (17px / 1.8, 1.5em gaps,
 * 4px blue quote) are exactly the values the correction replaces. Inline wins
 * on every one of them without a specificity fight, and the values stay next
 * to the markup they describe.
 */
const paragraphStyle: CSSProperties = { marginTop: 0, marginBottom: "1.15em" };
const listStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: "1.15em",
  paddingLeft: "1.5em",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const listItemStyle: CSSProperties = { marginTop: 0 };
const h2Style: CSSProperties = {
  marginTop: "48px",
  marginBottom: "16px",
  fontSize: "28px",
  lineHeight: 1.35,
  fontWeight: 600,
};
const h3Style: CSSProperties = {
  marginTop: "32px",
  marginBottom: "12px",
  fontSize: "20px",
  lineHeight: 1.4,
  fontWeight: 600,
};

export function GuideTutorialBody({
  segments,
  fontSize = READER_DEFAULT_FONT_SIZE,
  lineHeight = READER_DEFAULT_LINE_HEIGHT,
}: {
  segments: GuideSegment[];
  fontSize?: number;
  lineHeight?: number;
}) {
  return (
    <div className="guide-reader article-body" style={{ fontSize, lineHeight }}>
      {segments.map((segment, index) => {
        if (segment.kind === "heading") {
          const Heading = segment.level >= 3 ? "h3" : "h2";
          return (
            <Heading
              key={segment.id ?? `h-${index}`}
              id={segment.id ?? undefined}
              style={segment.level >= 3 ? h3Style : h2Style}
            >
              {segment.text}
            </Heading>
          );
        }

        if (segment.kind === "steps") {
          return <GuideStepList key={`steps-${index}`} steps={segment.steps} />;
        }

        if (segment.kind === "bullets") {
          return (
            <ul key={`bullets-${index}`} style={listStyle}>
              {segment.items.map((item, itemIndex) => (
                <li key={`bullet-${itemIndex}`} style={listItemStyle}>
                  {item.text}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`p-${index}`} className="whitespace-pre-wrap" style={paragraphStyle}>
            {segment.text}
          </p>
        );
      })}
    </div>
  );
}

function GuideStepList({ steps }: { steps: GuideStep[] }) {
  return (
    <ol style={listStyle}>
      {steps.map((step) => (
        <li key={step.id} id={step.id} value={Number(step.marker)} style={listItemStyle}>
          {step.text}
        </li>
      ))}
    </ol>
  );
}

/*
 * 「上一篇 / 下一篇」— a row list, not two cards (用户 2026-11-10 修正:
 * content pages use the SK6 row rhythm; the whole row is the link).
 */
export function GuidePager({
  previous,
  next,
}: {
  previous?: GuideCatalogEntry;
  next?: GuideCatalogEntry;
}) {
  if (!previous && !next) return null;

  return (
    <nav aria-label="相邻指南">
      <ul className="list-none p-0">
        {previous ? <PagerRow entry={previous} direction="previous" /> : null}
        {next ? <PagerRow entry={next} direction="next" /> : null}
      </ul>
    </nav>
  );
}

function PagerRow({
  entry,
  direction,
}: {
  entry: GuideCatalogEntry;
  direction: "previous" | "next";
}) {
  const forward = direction === "next";
  const Icon = forward ? ChevronRight : ChevronLeft;

  return (
    <FeedRow
      meta={
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {forward ? "下一篇" : "上一篇"}
          <Icon aria-hidden className="h-3.5 w-3.5" />
        </span>
      }
    >
      <Link
        to={entry.href}
        className="focus-ring block rounded-sm text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
      >
        {/* The direction stays in the link's accessible name: the meta slot is
            a separate node, so "下一篇" would otherwise announce nothing. */}
        <span className="sr-only">{forward ? "下一篇 " : "上一篇 "}</span>
        {entry.title}
      </Link>
      <p className="mt-1 text-meta text-muted-foreground">{entry.description}</p>
    </FeedRow>
  );
}
