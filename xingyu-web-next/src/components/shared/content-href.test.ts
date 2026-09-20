import { describe, expect, it } from "vitest";
import { contentHref } from "./ContentCard";
import type { ContentSummary } from "@/api/common.types";

/*
 * Regression tests for the Phase 1A live-acceptance fix.
 *
 * Verified against the real backend:
 *  - /api/v1/search returns only ARTICLE hits and exposes no slug/username,
 *    so TOPIC / USER / SERIES cannot be linked reliably.
 *  - /api/v1/home DOES return SERIES hits, but no series route exists yet.
 * Therefore only ARTICLE may produce a real link; emitting /series/:id or a
 * guessed /u/:id, /topics/:id would be a dead link.
 */

const base: ContentSummary = { id: "abc-123", title: "t" };

describe("contentHref", () => {
  it("links ARTICLE hits to the article route", () => {
    expect(contentHref({ ...base, objectType: "ARTICLE" })).toBe("/articles/abc-123");
  });

  it("degrades SERIES to discover instead of a dead /series/:id link", () => {
    const href = contentHref({ ...base, objectType: "SERIES" });
    expect(href).toBe("/discover");
    expect(href).not.toContain("/series/");
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
