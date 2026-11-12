import { describe, expect, it } from "vitest";
import { segmentGuideDocument } from "./guide-steps";

const NUMBERED = "1. 注册并完善个人资料\n2. 在发现页浏览内容";

describe("segmentGuideDocument", () => {
  it("turns a paragraph of numbered lines into steps and leaves the lede as prose", () => {
    const { segments, steps } = segmentGuideDocument({
      blocks: [
        { type: "paragraph", text: "先读这一段。", level: 0 },
        { type: "paragraph", text: NUMBERED, level: 0 },
      ],
      body: "ignored",
    });

    expect(segments.map((segment) => segment.kind)).toEqual(["prose", "steps"]);
    expect(steps.map((step) => step.text)).toEqual(["注册并完善个人资料", "在发现页浏览内容"]);
    expect(steps.map((step) => step.id)).toEqual(["guide-step-1", "guide-step-2"]);
  });

  it("keeps a single numbered line and mixed prose as paragraphs", () => {
    const single = segmentGuideDocument({
      blocks: [{ type: "paragraph", text: "1. 只有一行", level: 0 }],
      body: "",
    });
    expect(single.steps).toEqual([]);
    expect(single.segments).toEqual([{ kind: "prose", text: "1. 只有一行" }]);

    const mixed = segmentGuideDocument({
      body: "说明如下：\n1. 这不是整段步骤",
    });
    expect(mixed.steps).toEqual([]);
  });

  it("splits a plain body on blank lines when blocks are absent", () => {
    const { steps } = segmentGuideDocument({
      body: `引言。\n\n${NUMBERED}`,
    });
    expect(steps).toHaveLength(2);
  });

  /*
   * 用户 2026-11-10：后端把每个编号行各发成一个 paragraph block，页面上就成了
   * 4 个独立段落（每段之间一大截空白）。连续的编号段落必须合并成同一个 `<ol>`。
   */
  it("merges consecutive single-line numbered paragraphs into one step list", () => {
    const { segments, steps } = segmentGuideDocument({
      blocks: [
        { type: "paragraph", text: "先读这一段。", level: 0 },
        { type: "paragraph", text: "1. 注册并完善个人资料", level: 0 },
        { type: "paragraph", text: "2. 在发现页浏览内容", level: 0 },
        { type: "paragraph", text: "3. 关注感兴趣的创作者", level: 0 },
        { type: "paragraph", text: "说明结束。", level: 0 },
      ],
      body: "",
    });

    expect(segments.map((segment) => segment.kind)).toEqual(["prose", "steps", "prose"]);
    expect(steps.map((step) => step.id)).toEqual(["guide-step-1", "guide-step-2", "guide-step-3"]);
  });

  it("merges consecutive bullet lines into one unordered list segment", () => {
    const { segments, steps } = segmentGuideDocument({
      blocks: [
        { type: "paragraph", text: "- 先注册", level: 0 },
        { type: "paragraph", text: "- 再浏览", level: 0 },
        { type: "paragraph", text: "* 最后创作", level: 0 },
      ],
      body: "",
    });

    expect(segments).toEqual([
      {
        kind: "bullets",
        items: [{ text: "先注册" }, { text: "再浏览" }, { text: "最后创作" }],
      },
    ]);
    expect(steps).toEqual([]);
  });
});
