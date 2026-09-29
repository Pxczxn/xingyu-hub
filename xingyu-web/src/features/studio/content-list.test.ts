import { describe, expect, it } from "vitest";
import type { MyArticleSummary, TrashItem } from "@/api/articles/articles.types";
import {
  CONTENT_TABS,
  articleListTitle,
  articleStatusLabel,
  canTrash,
  countByStatus,
  filterByTab,
  formatArticleTime,
  isReviewing,
  splitTrash,
  trashItemTitle,
} from "./content-list";

function article(over: Partial<MyArticleSummary> = {}): MyArticleSummary {
  return {
    id: "a1",
    status: "DRAFT",
    title: "标题",
    categoryId: null,
    updatedAt: "2026-09-28T10:00:00Z",
    ...over,
  };
}

function trashItem(over: Partial<TrashItem> = {}): TrashItem {
  return {
    objectType: "ARTICLE",
    objectId: "a1",
    title: "被删的文章",
    trashedAt: "2026-09-28T10:00:00Z",
    ...over,
  };
}

describe("CONTENT_TABS", () => {
  it("covers all six tabs in reading order", () => {
    expect(CONTENT_TABS.map((tab) => tab.id)).toEqual([
      "all",
      "published",
      "drafts",
      "reviewing",
      "returned",
      "trash",
    ]);
  });
});

describe("articleStatusLabel", () => {
  it("maps the statuses the backend emits", () => {
    expect(articleStatusLabel("PUBLISHED")).toBe("已发布");
    expect(articleStatusLabel("DRAFT")).toBe("草稿");
    expect(articleStatusLabel("RETURNED")).toBe("被退回");
    expect(articleStatusLabel("TRASHED")).toBe("回收站");
  });

  it("maps BOTH review spellings to one label", () => {
    expect(articleStatusLabel("REVIEW")).toBe("审核中");
    expect(articleStatusLabel("REVIEWING")).toBe("审核中");
  });

  it("echoes an unknown status verbatim instead of guessing", () => {
    // Containment: a status we do not know must be visible, not blank.
    expect(articleStatusLabel("ARCHIVED")).toBe("ARCHIVED");
    expect(articleStatusLabel("WEIRD_NEW_STATUS")).toBe("WEIRD_NEW_STATUS");
  });

  it("falls back to an explicit label for empty input", () => {
    expect(articleStatusLabel(null)).toBe("未知状态");
    expect(articleStatusLabel(undefined)).toBe("未知状态");
    expect(articleStatusLabel("")).toBe("未知状态");
    expect(articleStatusLabel("   ")).toBe("未知状态");
  });

  it("is case-insensitive on input", () => {
    expect(articleStatusLabel("published")).toBe("已发布");
  });
});

describe("isReviewing", () => {
  it("accepts both backend spellings, case-insensitively", () => {
    expect(isReviewing("REVIEW")).toBe(true);
    expect(isReviewing("REVIEWING")).toBe(true);
    expect(isReviewing("reviewing")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isReviewing("DRAFT")).toBe(false);
    expect(isReviewing("PUBLISHED")).toBe(false);
    expect(isReviewing(null)).toBe(false);
    expect(isReviewing("")).toBe(false);
  });

  it("does not treat REVIEWED as reviewing", () => {
    // Guards against a prefix-matching regression.
    expect(isReviewing("REVIEWED")).toBe(false);
  });
});

describe("filterByTab", () => {
  const items = [
    article({ id: "1", status: "PUBLISHED" }),
    article({ id: "2", status: "DRAFT" }),
    article({ id: "3", status: "REVIEW" }),
    article({ id: "4", status: "REVIEWING" }),
    article({ id: "5", status: "RETURNED" }),
    article({ id: "6", status: "ARCHIVED" }),
  ];

  it("returns everything for the all tab, preserving server order", () => {
    expect(filterByTab(items, "all").map((a) => a.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("filters each known status", () => {
    expect(filterByTab(items, "published").map((a) => a.id)).toEqual(["1"]);
    expect(filterByTab(items, "drafts").map((a) => a.id)).toEqual(["2"]);
    expect(filterByTab(items, "returned").map((a) => a.id)).toEqual(["5"]);
  });

  it("groups both review spellings under the reviewing tab", () => {
    expect(filterByTab(items, "reviewing").map((a) => a.id)).toEqual(["3", "4"]);
  });

  it("does NOT leak unknown statuses into any filtered tab", () => {
    const inTabs = ["published", "drafts", "reviewing", "returned"] as const;
    const ids = inTabs.flatMap((tab) => filterByTab(items, tab).map((a) => a.id));
    expect(ids).not.toContain("6");
  });

  it("returns an empty array for trash — it is a different endpoint, not a status", () => {
    // Critical: trash rows are TrashItem, not MyArticleSummary. Returning the
    // full list here would render every article under the trash tab.
    expect(filterByTab(items, "trash")).toEqual([]);
  });

  it("handles a missing status field without throwing", () => {
    const broken = [article({ id: "x", status: undefined as unknown as string })];
    expect(filterByTab(broken, "drafts")).toEqual([]);
    expect(filterByTab(broken, "all")).toHaveLength(1);
  });
});

describe("countByStatus", () => {
  it("counts the whole list regardless of tab", () => {
    const items = [
      article({ status: "PUBLISHED" }),
      article({ status: "PUBLISHED" }),
      article({ status: "DRAFT" }),
      article({ status: "REVIEW" }),
      article({ status: "REVIEWING" }),
      article({ status: "RETURNED" }),
    ];
    expect(countByStatus(items)).toEqual({ published: 2, draft: 1, review: 2, returned: 1 });
  });

  it("returns zeros for an empty list", () => {
    expect(countByStatus([])).toEqual({ published: 0, draft: 0, review: 0, returned: 0 });
  });

  it("ignores unknown statuses", () => {
    expect(countByStatus([article({ status: "ARCHIVED" })])).toEqual({
      published: 0,
      draft: 0,
      review: 0,
      returned: 0,
    });
  });
});

describe("canTrash", () => {
  it("allows drafts and published pieces", () => {
    expect(canTrash(article({ status: "DRAFT" }))).toBe(true);
    expect(canTrash(article({ status: "PUBLISHED" }))).toBe(true);
    expect(canTrash(article({ status: "RETURNED" }))).toBe(true);
  });

  it("refuses pieces in the review queue — the backend 409s on those", () => {
    // TrashService: 「审核中的文章不可移入回收站」
    expect(canTrash(article({ status: "REVIEW" }))).toBe(false);
    expect(canTrash(article({ status: "REVIEWING" }))).toBe(false);
  });
});

describe("splitTrash", () => {
  it("separates article rows from other object kinds", () => {
    const { articles, others } = splitTrash([
      trashItem({ objectId: "a1", objectType: "ARTICLE" }),
      trashItem({ objectId: "c1", objectType: "COLLECTION" }),
      trashItem({ objectId: "a2", objectType: "ARTICLE" }),
    ]);
    expect(articles.map((i) => i.objectId)).toEqual(["a1", "a2"]);
    expect(others.map((i) => i.objectId)).toEqual(["c1"]);
  });

  it("treats an unknown object type as 'other' rather than assuming article", () => {
    const { articles, others } = splitTrash([trashItem({ objectType: "SOMETHING" })]);
    expect(articles).toEqual([]);
    expect(others).toHaveLength(1);
  });

  it("handles an empty trash", () => {
    expect(splitTrash([])).toEqual({ articles: [], others: [] });
  });

  it("is case-insensitive about objectType", () => {
    const { articles } = splitTrash([trashItem({ objectType: "article" })]);
    expect(articles).toHaveLength(1);
  });
});

describe("titles", () => {
  it("falls back explicitly when the title is null or blank", () => {
    expect(trashItemTitle(trashItem({ title: null }))).toBe("无标题文章");
    expect(trashItemTitle(trashItem({ title: "   " }))).toBe("无标题文章");
    expect(trashItemTitle(trashItem({ title: "真标题" }))).toBe("真标题");
    expect(articleListTitle(article({ title: null }))).toBe("无标题文章");
    expect(articleListTitle(article({ title: "" }))).toBe("无标题文章");
    expect(articleListTitle(article({ title: "标题" }))).toBe("标题");
  });
});

describe("formatArticleTime", () => {
  it("formats an ISO timestamp", () => {
    expect(formatArticleTime("2026-09-28T10:00:00Z")).not.toBe("2026-09-28T10:00:00Z");
  });

  it("returns the raw value when it cannot be parsed", () => {
    expect(formatArticleTime("not-a-date")).toBe("not-a-date");
    expect(formatArticleTime("")).toBe("");
  });
});
