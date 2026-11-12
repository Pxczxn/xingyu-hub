import type { GuideBlock } from "@/api/guide/guide.types";

/*
 * Guide content segmentation — the reading-page renderer's block model.
 *
 * A tutorial step is a line the author numbered on purpose: "1. 注册并完善个人资料".
 * The server only emits headings and paragraphs (GuideService.extractBlocks), so
 * the client recognizes list lines here.
 *
 * 2026-11-10 (user correction): consecutive numbered lines must become ONE
 * `<ol>`, even when the server delivered each line as its own paragraph block.
 * Before this, "1. …" / "2. …" / "3. …" rendered as three paragraphs with a
 * paragraph gap between each, which is what made the guide look like a wall of
 * loose text. The same merge now applies to `- `/`* ` bullet lines.
 *
 * A single list line on its own stays prose (`1. 只有一行` is a sentence that
 * happens to start with a digit, not a one-item list), and a paragraph that
 * mixes prose with a list marker stays prose — guessing there would turn a
 * sentence into a step.
 */
const STEP_LINE = /^(\d+)[.、．)]\s+(\S.*)$/;
const BULLET_LINE = /^[-*]\s+(\S.*)$/;

export type GuideStep = {
  id: string;
  marker: string;
  text: string;
};

export type GuideBullet = {
  text: string;
};

export type GuideSegment =
  | { kind: "prose"; text: string }
  | { kind: "heading"; level: number; id?: string | null; text: string }
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
    parsed.push({ marker: match[1], text: match[2] });
  }

  return parsed.map((step, index) => ({
    id: `guide-step-${startIndex + index + 1}`,
    marker: step.marker,
    text: step.text,
  }));
}

export function guideReadingMinutes(text: string): number {
  const count = text.replace(/\s/g, "").length;
  return Math.max(1, Math.round(count / 400));
}

type Chunk =
  | { kind: "prose"; text: string }
  | { kind: "heading"; level: number; id?: string | null; text: string };

type ListLine =
  | { ordered: true; marker: string; text: string; raw: string }
  | { ordered: false; marker: "-"; text: string; raw: string };

function parseListLine(line: string): ListLine | null {
  const ordered = STEP_LINE.exec(line);
  if (ordered) return { ordered: true, marker: ordered[1], text: ordered[2], raw: line };
  const bullet = BULLET_LINE.exec(line);
  if (bullet) return { ordered: false, marker: "-", text: bullet[1], raw: line };
  return null;
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
  /* Consecutive list-only chunks accumulate here; a non-list chunk, a heading,
     or a change of list type flushes them into one segment. */
  let pending: { ordered: boolean; lines: ListLine[] } | null = null;

  const flush = () => {
    if (!pending) return;
    const { ordered, lines } = pending;
    pending = null;
    if (lines.length < 2) {
      /* A lone marker line is prose, verbatim. */
      segments.push({ kind: "prose", text: lines[0]?.raw ?? "" });
      return;
    }
    if (ordered) {
      const group: GuideStep[] = lines.map((line, index) => ({
        id: `guide-step-${steps.length + index + 1}`,
        marker: line.marker,
        text: line.text,
      }));
      steps.push(...group);
      segments.push({ kind: "steps", steps: group });
      return;
    }
    segments.push({ kind: "bullets", items: lines.map((line) => ({ text: line.text })) });
  };

  for (const chunk of chunks) {
    if (chunk.kind === "heading") {
      flush();
      segments.push(chunk);
      continue;
    }

    const lines = chunk.text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const parsed = lines.map(parseListLine);
    const listOnly = parsed.length > 0 && parsed.every((line) => line !== null);
    const sameType =
      listOnly && parsed.every((line) => line?.ordered === parsed[0]?.ordered);

    if (!listOnly || !sameType) {
      /* Mixed prose + markers: keep the paragraph as it was. */
      flush();
      segments.push(chunk);
      continue;
    }

    const ordered = parsed[0]?.ordered ?? true;
    if (pending && pending.ordered !== ordered) flush();
    if (!pending) pending = { ordered, lines: [] };
    pending.lines.push(...(parsed as ListLine[]));
  }

  flush();
  return { segments, steps };
}
