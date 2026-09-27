import { describe, expect, it } from "vitest";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import type { SeriesSummary } from "@/api/series/series.types";
import type { MomentView } from "@/api/moments/moments.types";
import {
  SUBMISSION_OBJECT_TYPES,
  momentTitle,
  submittableArticles,
  submittableMoments,
  submittableSeries,
} from "./events.picker";

/*
 * The submit-page allow-list (Phase 2I-4).
 *
 * The whole point of this module is that the submit endpoint 404s with
 * 「投稿内容不存在」 for anything not in `search_document`, which is what an
 * unpublished article produces. So these tests are less about mapping and more
 * about what is EXCLUDED — offering an option that cannot succeed sends the user
 * into an error message that blames the wrong thing.
 */

function article(overrides: Partial<MyArticleSummary> = {}): MyArticleSummary {
  return {
    id: "a1",
    status: "PUBLISHED",
    title: "我的文章",
    categoryId: null,
    updatedAt: "2026-09-27T02:00:00Z",
    ...overrides,
  };
}

function series(overrides: Partial<SeriesSummary> = {}): SeriesSummary {
  return {
    id: "s1",
    title: "我的系列",
    slug: "mine",
    description: null,
    status: "ACTIVE",
    chapterCount: 3,
    updatedAt: "2026-09-27T02:00:00Z",
    ...overrides,
  };
}

function moment(overrides: Partial<MomentView> = {}): MomentView {
  return {
    id: "m1",
    body: "今天写了点东西",
    authorId: "me",
    createdAt: "2026-09-27T02:00:00Z",
    ...overrides,
  };
}

describe("submittableArticles", () => {
  it("keeps a PUBLISHED article", () => {
    expect(submittableArticles([article({ status: "PUBLISHED" })])).toEqual([
      { objectType: "ARTICLE", objectId: "a1", title: "我的文章" },
    ]);
  });

  it("EXCLUDES a draft — it is not in search_document and would 404", () => {
    expect(submittableArticles([article({ status: "DRAFT" })])).toEqual([]);
  });

  it("excludes an in-review article too — submitted is not published", () => {
    // The tempting mistake: IN_REVIEW looks 'nearly done'. It still is not
    // published, so the index has no row for it.
    expect(submittableArticles([article({ status: "IN_REVIEW" })])).toEqual([]);
  });

  it("is case-insensitive about the status", () => {
    expect(submittableArticles([article({ status: "published" })])).toHaveLength(1);
  });

  it("treats an unknown status as a draft and excludes it", () => {
    // normalizeLifecycleStatus falls back to DRAFT for anything unrecognised, so
    // a novel server status is never optimistically offered.
    expect(submittableArticles([article({ status: "SCHEDULED" })])).toEqual([]);
  });

  it("prefers lifecycleStatus when the server sends both", () => {
    // The owner list can carry a workflow `status` and a `lifecycleStatus`; the
    // lifecycle one is the editorial truth.
    expect(
      submittableArticles([article({ status: "PUBLISHED", lifecycleStatus: "DRAFT" })]),
    ).toHaveLength(1);
  });

  it("falls back to an honest title for an untitled article", () => {
    expect(submittableArticles([article({ title: null })])[0].title).toBe("未命名文章");
    expect(submittableArticles([article({ title: "   " })])[0].title).toBe("未命名文章");
  });

  it("filters rather than fails when the list is mixed", () => {
    const options = submittableArticles([
      article({ id: "pub", status: "PUBLISHED" }),
      article({ id: "draft", status: "DRAFT" }),
      article({ id: "review", status: "IN_REVIEW" }),
    ]);
    expect(options.map((option) => option.objectId)).toEqual(["pub"]);
  });
});

describe("submittableSeries", () => {
  it("keeps an ACTIVE series", () => {
    expect(submittableSeries([series()])).toEqual([
      { objectType: "SERIES", objectId: "s1", title: "我的系列" },
    ]);
  });

  it("excludes an ARCHIVED series", () => {
    expect(submittableSeries([series({ status: "ARCHIVED" })])).toEqual([]);
  });

  it("falls back to an honest title for an empty one", () => {
    expect(submittableSeries([series({ title: "" })])[0].title).toBe("未命名系列");
  });
});

describe("submittableMoments", () => {
  it("keeps every moment — a moment has no draft state", () => {
    expect(submittableMoments([moment(), moment({ id: "m2" })])).toHaveLength(2);
  });

  it("uses the body as the title, since a moment has none", () => {
    expect(submittableMoments([moment()])[0].title).toBe("今天写了点东西");
  });

  it("keeps only the first line", () => {
    expect(submittableMoments([moment({ body: "第一行\n第二行" })])[0].title).toBe("第一行");
  });
});

describe("momentTitle", () => {
  it("truncates a long body rather than letting the list overflow", () => {
    const long = "啊".repeat(60);
    const title = momentTitle(moment({ body: long }));
    expect(title).toBe(`${"啊".repeat(40)}…`);
    expect(title.length).toBe(41);
  });

  it("does not truncate at exactly the limit", () => {
    const exact = "啊".repeat(40);
    expect(momentTitle(moment({ body: exact }))).toBe(exact);
  });

  it("says so plainly when there is no body text", () => {
    expect(momentTitle(moment({ body: "" }))).toBe("无正文动态");
    expect(momentTitle(moment({ body: "   " }))).toBe("无正文动态");
  });
});

describe("SUBMISSION_OBJECT_TYPES", () => {
  it("lists exactly the three backend-supported types, in display order", () => {
    expect(SUBMISSION_OBJECT_TYPES).toEqual(["ARTICLE", "SERIES", "MOMENT"]);
  });
});
