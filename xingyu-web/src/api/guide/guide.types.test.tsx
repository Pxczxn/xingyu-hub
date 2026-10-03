import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { guideOutline, type GuideBlock } from "./guide.types";
import { GuideBody } from "@/features/guide/components/GuideBody";

/*
 * Structured guide / rules bodies.
 *
 * Added 2026-10-03. The document used to arrive as one plain-text string, which
 * made a clause outline impossible — the client could not know which line was a
 * heading. The server now returns blocks and marks the headings, and these cover
 * both halves of that: the outline the headings produce, and the fallback when a
 * backend has not shipped blocks yet.
 */

const BLOCKS: GuideBlock[] = [
  { type: "heading", text: "总则", id: "guide-heading-0", level: 2 },
  { type: "paragraph", text: "本规则适用于全部公开空间。", level: 0 },
  { type: "heading", text: "内容规范", id: "guide-heading-1", level: 2 },
  { type: "paragraph", text: "请勿发布违法内容。", level: 0 },
];

describe("guideOutline", () => {
  it("lists only the headings", () => {
    const outline = guideOutline(BLOCKS);
    expect(outline.map((b) => b.text)).toEqual(["总则", "内容规范"]);
  });

  it("returns nothing for a body written without markers", () => {
    // The honest answer: there is no outline. Rendering an empty table of
    // contents would be worse than showing none.
    expect(guideOutline([{ type: "paragraph", text: "一整段话。", level: 0 }])).toEqual([]);
  });

  it("tolerates a missing blocks field", () => {
    expect(guideOutline(null)).toEqual([]);
    expect(guideOutline(undefined)).toEqual([]);
  });
});

describe("GuideBody", () => {
  it("renders headings with their anchor ids", () => {
    render(<GuideBody blocks={BLOCKS} body="ignored" />);

    const heading = screen.getByRole("heading", { name: "总则" });
    expect(heading).toHaveAttribute("id", "guide-heading-0");
  });

  it("falls back to the plain body when there are no blocks", () => {
    // A backend that has not shipped `blocks` must keep working unchanged.
    render(<GuideBody blocks={null} body="一段纯文本。" />);
    expect(screen.getByText("一段纯文本。")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("never emits an h1", () => {
    // The page owns the h1; a document section is not the page.
    const { container } = render(<GuideBody blocks={BLOCKS} body="ignored" />);
    expect(container.querySelector("h1")).toBeNull();
  });

  it("uses h3 for a level-3 sub-clause", () => {
    render(
      <GuideBody
        blocks={[{ type: "heading", text: "细则", id: "guide-heading-2", level: 3 }]}
        body="ignored"
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "细则" })).toBeInTheDocument();
  });
});
