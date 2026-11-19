import type { GuideBlock } from "@/api/guide/guide.types";

/*
 * Guide content segmentation — the reading-page renderer's block model.
 *
 * A tutorial step is a line the author numbered on purpose: "1. 注册并完善个人资料".
 * The server emits headings, paragraphs, code fences and quotes. List structure
 * (including indent) stays in paragraph text so this module can nest items
 * without changing the article Markdown pipeline.
 *
 * 2026-11-10 (user correction): consecutive numbered lines must become ONE
 * `<ol>`, even when the server delivered each line as its own paragraph block.
 * The same merge applies to `- `/`* ` bullet lines.
 *
 * A single list line on its own stays prose (`1. 只有一行` is a sentence that
 * happens to start with a digit, not a one-item list), and a paragraph that
 * mixes prose with a list marker stays prose — guessing there would turn a
 * sentence into a step.
 */
const STEP_LINE = /^(\s*)(\d+)[.、．)]\s+(\S.*)$/;
const BULLET_LINE = /^(\s*)[-*]\s+(\S.*)$/;

export type GuideListItem = {
  ordered: boolean;
  marker: string;
  text: string;
  children: GuideListItem[];
};

export type GuideStep = {
  id: string;
  marker: string;
  text: string;
  children: GuideListItem[];
};

export type GuideBullet = {
  text: string;
  children: GuideListItem[];
};

export type GuideSegment =
  | { kind: "prose"; text: string }
  | { kind: "heading"; level: number; id?: string | null; text: string }
  | { kind: "code"; text: string; lang?: string | null }
  | { kind: "quote"; text: string }
  | { kind: "steps"; steps: GuideStep[] }
  | { kind: "bullets"; items: GuideBullet[] };

export function parseNumberedSteps(text: string, startIndex: number): GuideStep[] | null {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return null;

  const parsed: { marker: string; text: string }[] = [];
  for (const line of lines) {
    const match = STEP_LINE.exec(line);
    if (!match) return null;
    parsed.push({ marker: match[2], text: match[3] });
  }

  return parsed.map((step, index) => ({
    id: `guide-step-${startIndex + index + 1}`,
    marker: step.marker,
    text: step.text,
    children: [],
  }));
}

export function guideReadingMinutes(text: string): number {
  const count = text.replace(/\s/g, "").length;
  return Math.max(1, Math.round(count / 400));
}

type Chunk =
  | { kind: "prose"; text: string }
  | { kind: "heading"; level: number; id?: string | null; text: string }
  | { kind: "code"; text: string; lang?: string | null }
  | { kind: "quote"; text: string };

type ListLine =
  | { ordered: true; marker: string; text: string; raw: string; indent: number }
  | { ordered: false; marker: "-"; text: string; raw: string; indent: number };

function indentWidth(prefix: string): number {
  let width = 0;
  for (const char of prefix) {
    width += char === "\t" ? 4 : 1;
  }
  return width;
}

function parseListLine(line: string): ListLine | null {
  const ordered = STEP_LINE.exec(line);
  if (ordered) {
    return {
      ordered: true,
      marker: ordered[2],
      text: ordered[3],
      raw: line,
      indent: indentWidth(ordered[1]),
    };
  }
  const bullet = BULLET_LINE.exec(line);
  if (bullet) {
    return {
      ordered: false,
      marker: "-",
      text: bullet[2],
      raw: line,
      indent: indentWidth(bullet[1]),
    };
  }
  return null;
}

function buildListTree(lines: ListLine[]): GuideListItem[] {
  const roots: GuideListItem[] = [];
  const stack: { indent: number; item: GuideListItem }[] = [];
  for (const line of lines) {
    const item: GuideListItem = {
      ordered: line.ordered,
      marker: line.marker,
      text: line.text,
      children: [],
    };
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= line.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (!parent) {
      roots.push(item);
    } else {
      parent.item.children.push(item);
    }
    stack.push({ indent: line.indent, item });
  }
  return roots;
}

function groupByOrdered(items: GuideListItem[]): { ordered: boolean; items: GuideListItem[] }[] {
  const groups: { ordered: boolean; items: GuideListItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.ordered === item.ordered) {
      last.items.push(item);
    } else {
      groups.push({ ordered: item.ordered, items: [item] });
    }
  }
  return groups;
}

export function segmentGuideDocument(input: { blocks?: GuideBlock[] | null; body: string }): {
  segments: GuideSegment[];
  steps: GuideStep[];
} {
  const chunks: Chunk[] = [];

  if (input.blocks && input.blocks.length > 0) {
    for (const block of input.blocks) {
      if (block.type === "heading") {
        chunks.push({ kind: "heading", level: block.level, id: block.id, text: block.text });
      } else if (block.type === "code") {
        chunks.push({ kind: "code", text: block.text, lang: block.lang });
      } else if (block.type === "quote") {
        chunks.push({ kind: "quote", text: block.text });
      } else {
        chunks.push({ kind: "prose", text: block.text });
      }
    }
  } else {
    for (const part of input.body.split(/\n\s*\n/)) {
      const text = part.trim();
      if (text) chunks.push({ kind: "prose", text });
    }
  }

  const segments: GuideSegment[] = [];
  const steps: GuideStep[] = [];
  let pending: ListLine[] | null = null;

  const flush = () => {
    if (!pending) return;
    const lines = pending;
    pending = null;
    if (lines.length < 2) {
      segments.push({ kind: "prose", text: lines[0]?.raw ?? "" });
      return;
    }
    const tree = buildListTree(lines);
    for (const group of groupByOrdered(tree)) {
      if (group.ordered) {
        const groupSteps: GuideStep[] = group.items.map((item, index) => ({
          id: `guide-step-${steps.length + index + 1}`,
          marker: item.marker,
          text: item.text,
          children: item.children,
        }));
        steps.push(...groupSteps);
        segments.push({ kind: "steps", steps: groupSteps });
      } else {
        segments.push({
          kind: "bullets",
          items: group.items.map((item) => ({ text: item.text, children: item.children })),
        });
      }
    }
  };

  for (const chunk of chunks) {
    if (chunk.kind === "heading" || chunk.kind === "code" || chunk.kind === "quote") {
      flush();
      segments.push(chunk);
      continue;
    }

    const lines = chunk.text.split(/\n/).filter((line) => line.trim().length > 0);
    const parsed = lines.map(parseListLine);
    const listOnly = parsed.length > 0 && parsed.every((line) => line !== null);

    if (!listOnly) {
      flush();
      segments.push(chunk);
      continue;
    }

    if (!pending) pending = [];
    pending.push(...(parsed as ListLine[]));
  }

  flush();
  return { segments, steps };
}
