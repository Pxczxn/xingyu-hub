import { describe, expect, it } from "vitest";
import {
  chapterIds,
  moveChapterEntry,
  removeChapterEntry,
  reorderChapterEntries,
  restoreChapterEntry,
  sameChapterOrder,
  toChapterEntries,
  type ChapterEntry,
} from "./series-order";

const entries: ChapterEntry[] = [
  { articleId: "a1", title: "第一章" },
  { articleId: "a2", title: "第二章" },
  { articleId: "a3", title: "第三章" },
];

describe("series chapter order", () => {
  it("sorts server chapters by position and drops duplicate article ids", () => {
    const result = toChapterEntries([
      { id: "c3", articleId: "a3", title: "三", position: 3 },
      { id: "c1", articleId: "a1", title: "一", position: 1 },
      { id: "c1b", articleId: "a1", title: "一（重复）", position: 2 },
      { id: "c2", articleId: "a2", title: null, position: 2 },
    ]);
    expect(result).toEqual([
      { articleId: "a1", title: "一" },
      { articleId: "a2", title: null },
      { articleId: "a3", title: "三" },
    ]);
  });

  it("compares order by article id, not by length alone", () => {
    expect(sameChapterOrder(["a1", "a2"], ["a1", "a2"])).toBe(true);
    expect(sameChapterOrder(["a2", "a1"], ["a1", "a2"])).toBe(false);
    expect(sameChapterOrder(["a1"], ["a1", "a2"])).toBe(false);
  });

  it("reorders by identity and returns the original array when nothing changes", () => {
    expect(chapterIds(reorderChapterEntries(entries, "a3", "a1"))).toEqual(["a3", "a1", "a2"]);
    expect(reorderChapterEntries(entries, "a1", "a1")).toBe(entries);
    expect(reorderChapterEntries(entries, "missing", "a1")).toBe(entries);
  });

  it("moves one step with boundary checks for the keyboard/button fallback", () => {
    expect(chapterIds(moveChapterEntry(entries, 0, 1))).toEqual(["a2", "a1", "a3"]);
    expect(chapterIds(moveChapterEntry(entries, 2, -1))).toEqual(["a1", "a3", "a2"]);
    expect(moveChapterEntry(entries, 0, -1)).toBe(entries);
    expect(moveChapterEntry(entries, 2, 1)).toBe(entries);
  });

  it("removes one relation and can restore it at the same position", () => {
    const { next, removed } = removeChapterEntry(entries, "a2");
    expect(chapterIds(next)).toEqual(["a1", "a3"]);
    expect(removed?.index).toBe(1);

    const restored = restoreChapterEntry(next, removed!.entry, removed!.index);
    expect(chapterIds(restored)).toEqual(["a1", "a2", "a3"]);
    expect(restored[1]).toBe(removed!.entry);
    expect(restoreChapterEntry(restored, removed!.entry, 0)).toBe(restored);
    expect(removeChapterEntry(entries, "missing").removed).toBeNull();
  });
});
