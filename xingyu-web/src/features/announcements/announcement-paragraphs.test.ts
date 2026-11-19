import { describe, expect, it } from "vitest";
import { announcementParagraphs } from "./announcement-paragraphs";

describe("announcementParagraphs", () => {
  it("keeps a single newline inside one paragraph", () => {
    expect(announcementParagraphs("甲\n乙")).toEqual(["甲\n乙"]);
  });

  it("splits one blank line into two paragraphs", () => {
    expect(announcementParagraphs("甲\n\n乙")).toEqual(["甲", "乙"]);
  });

  it("collapses two or more blank lines into one break", () => {
    expect(announcementParagraphs("甲\n\n\n乙")).toEqual(["甲", "乙"]);
    expect(announcementParagraphs("甲\n\n\n\n\n乙")).toEqual(["甲", "乙"]);
  });

  it("treats a spaces-only line as a blank line and keeps spaces on text", () => {
    expect(announcementParagraphs("甲\n   \n乙")).toEqual(["甲", "乙"]);
    expect(announcementParagraphs("甲\n\n  乙  \n丙")).toEqual(["甲", "  乙  \n丙"]);
  });

  it("keeps indentation on a single newline", () => {
    expect(announcementParagraphs("甲\n    乙")).toEqual(["甲\n    乙"]);
  });

  it("drops leading and trailing breaks without trimming the text", () => {
    expect(announcementParagraphs("\n\n  甲  \n\n")).toEqual(["  甲  "]);
  });

  it("normalizes CRLF and keeps the characters of markup as text", () => {
    expect(announcementParagraphs("甲\r\n\r\n<script>alert(1)</script>")).toEqual([
      "甲",
      "<script>alert(1)</script>",
    ]);
  });

  it("returns nothing for a body that is only breaks", () => {
    expect(announcementParagraphs("\n\n\n")).toEqual([]);
    expect(announcementParagraphs("   \n\t")).toEqual([]);
  });
});
