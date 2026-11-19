import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GuideCatalogEntry } from "@/features/guide/guide-catalog";
import type { GuideListItem, GuideSegment, GuideStep } from "@/features/guide/guide-steps";
import { FeedRow, READER_DEFAULT_FONT_SIZE, READER_DEFAULT_LINE_HEIGHT } from "@/components/layout";

/*
 * Guide prose — rendered inside the shared 内容阅读页 column.
 *
 * The locals below are the content typography the 2026-11-10 user correction
 * specified: 1.15em between paragraphs, 1.9 leading, h2 28/600 at the 18px
 * body (48 above, 16 below), real `<ol>`/`<ul>` for consecutive numbered/bulleted
 * lines with 8px between items and a 1.5em indent.
 *
 * Heading sizes stay em ratios (`1.5556em` / `1.2em`) so A−/A+ scales H2/H3.
 * H2's top margin is 2.667× the reading size (48px at 18px) instead of a 48px
 * pin, so the chapter break keeps its proportion when the size changes. H3
 * stays at `1.15em`, tighter than that chapter break.
 *
 * They are inline styles, not globals: `globals.css` `.guide-reader.article-body`
 * still pins 24/20px on headings, and inline wins without a specificity fight.
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
function headingStyle(fontSize: number, level: number): CSSProperties {
  if (level >= 3) {
    return {
      marginTop: "1.15em",
      marginBottom: "12px",
      fontSize: "1.2em",
      lineHeight: 1.4,
      fontWeight: 600,
    };
  }
  return {
    marginTop: `calc(${fontSize}px * 2.667)`,
    marginBottom: "16px",
    fontSize: "1.5556em",
    lineHeight: 1.35,
    fontWeight: 600,
  };
}

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
              style={headingStyle(fontSize, segment.level)}
            >
              {segment.text}
            </Heading>
          );
        }

        if (segment.kind === "code") {
          return (
            <pre key={`code-${index}`}>
              <code className={segment.lang ? `language-${segment.lang}` : undefined}>
                {segment.text}
              </code>
            </pre>
          );
        }

        if (segment.kind === "quote") {
          return (
            <blockquote key={`quote-${index}`}>
              <p className="whitespace-pre-wrap" style={paragraphStyle}>
                {segment.text}
              </p>
            </blockquote>
          );
        }

        if (segment.kind === "steps") {
          return <GuideStepList key={`steps-${index}`} steps={segment.steps} />;
        }

        if (segment.kind === "bullets") {
          return (
            <GuideList
              key={`bullets-${index}`}
              ordered={false}
              items={segment.items.map((item) => ({
                ordered: false,
                marker: "-",
                text: item.text,
                children: item.children,
              }))}
            />
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
          <NestedLists items={step.children} />
        </li>
      ))}
    </ol>
  );
}

function GuideList({ ordered, items }: { ordered: boolean; items: GuideListItem[] }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag style={listStyle}>
      {items.map((item, index) => (
        <li
          key={`${item.marker}-${item.text}-${index}`}
          value={ordered ? Number(item.marker) : undefined}
          style={listItemStyle}
        >
          {item.text}
          <NestedLists items={item.children} />
        </li>
      ))}
    </Tag>
  );
}

function NestedLists({ items }: { items: GuideListItem[] }) {
  if (items.length === 0) return null;
  const groups: { ordered: boolean; items: GuideListItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.ordered === item.ordered) {
      last.items.push(item);
    } else {
      groups.push({ ordered: item.ordered, items: [item] });
    }
  }
  return (
    <>
      {groups.map((group, index) => (
        <GuideList
          key={`${group.ordered ? "ol" : "ul"}-${index}`}
          ordered={group.ordered}
          items={group.items}
        />
      ))}
    </>
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
        <span className="flex items-center gap-1 text-caption text-muted-foreground">
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
