import { describe, expect, it } from "vitest";
import { contentHref } from "./ContentCard";
import type { ContentSummary } from "@/api/common.types";

/*
 * Regression tests for content-card link resolution.
 *
 * Originally written for the Phase 1A live-acceptance fix, when only ARTICLE had
 * a real route and SERIES had to degrade. That premise is gone: /series/:id
 * shipped in Phase 2G and /moments/:id in Phase 2D, and both /api/v1/home and
 * /api/v1/galaxies/{slug}/content hand back the object's own id — so SERIES and
 * MOMENT now resolve to real routes.
 *
 * TOPIC and USER still cannot: search exposes no slug and no username for them,
 * so guessing /topics/:id or /u/:id would be a dead link. Those stay degrading.
 */

const base: ContentSummary = { id: "abc-123", title: "t" };

describe("contentHref", () => {
  it("links ARTICLE hits to the article route", () => {
    expect(contentHref({ ...base, objectType: "ARTICLE" })).toBe("/articles/abc-123");
  });

  it("links SERIES hits to the series route", () => {
    expect(contentHref({ ...base, objectType: "SERIES" })).toBe("/series/abc-123");
  });

  it("links MOMENT hits to the moment route", () => {
    expect(contentHref({ ...base, objectType: "MOMENT" })).toBe("/moments/abc-123");
  });

  it("accepts a lowercase object type", () => {
    expect(contentHref({ ...base, objectType: "series" })).toBe("/series/abc-123");
  });

  it("does not guess a topic slug from an id", () => {
    const href = contentHref({ ...base, objectType: "TOPIC" });
    expect(href).toBe("/discover");
    expect(href).not.toContain("/topics/");
  });

  it("does not guess a username from an id", () => {
    const href = contentHref({ ...base, objectType: "USER" });
    expect(href).toBe("/discover");
    expect(href).not.toContain("/u/");
  });

  it("degrades unknown or missing object types to discover", () => {
    expect(contentHref({ ...base, objectType: "SOMETHING_NEW" })).toBe("/discover");
    expect(contentHref(base)).toBe("/discover");
  });
});
