import { describe, expect, it } from "vitest";
import { isLikelyUrl, isLinkUrlEmpty, normalizeLinkUrl } from "@/lib/article-editor-link-url";

describe("normalizeLinkUrl", () => {
  it("adds https for bare domains", () => {
    expect(normalizeLinkUrl("example.com")).toBe("https://example.com");
    expect(normalizeLinkUrl("www.example.com/path")).toBe("https://www.example.com/path");
  });

  it("preserves relative and hash links", () => {
    expect(normalizeLinkUrl("/articles/123")).toBe("/articles/123");
    expect(normalizeLinkUrl("#section")).toBe("#section");
  });

  it("preserves explicit protocols", () => {
    expect(normalizeLinkUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(normalizeLinkUrl("https://example.com")).toBe("https://example.com");
  });
});

describe("isLikelyUrl", () => {
  it("detects urls and site paths", () => {
    expect(isLikelyUrl("example.com")).toBe(true);
    expect(isLikelyUrl("/articles/demo")).toBe(true);
    expect(isLikelyUrl("普通文字")).toBe(false);
  });
});

describe("isLinkUrlEmpty", () => {
  it("treats blank values as empty", () => {
    expect(isLinkUrlEmpty("   ")).toBe(true);
    expect(isLinkUrlEmpty("example.com")).toBe(false);
  });
});
