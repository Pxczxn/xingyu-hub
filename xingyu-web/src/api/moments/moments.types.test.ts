import { describe, expect, it } from "vitest";
import { momentAuthorLabel, type MomentView } from "./moments.types";

/*
 * Who wrote a moment.
 *
 * Added 2026-10-03 with the backend's `authorUsername` / `authorDisplayName`.
 * Before them the contract carried only `authorId`, so a feed item could not say
 * who wrote it — and an opaque id is not an answer to "who".
 */

function makeMoment(overrides: Partial<MomentView> = {}): MomentView {
  return {
    id: "m1",
    body: "正文",
    authorId: "u-1",
    createdAt: "2026-10-03T00:00:00Z",
    ...overrides,
  };
}

describe("momentAuthorLabel", () => {
  it("prefers the display name", () => {
    expect(
      momentAuthorLabel(makeMoment({ authorDisplayName: "爱丽丝", authorUsername: "alice" })),
    ).toBe("爱丽丝");
  });

  it("falls back to the username when there is no display name", () => {
    expect(
      momentAuthorLabel(makeMoment({ authorDisplayName: null, authorUsername: "alice" })),
    ).toBe("alice");
  });

  it("ignores blank values rather than rendering an empty name", () => {
    expect(momentAuthorLabel(makeMoment({ authorDisplayName: "  ", authorUsername: " " }))).toBe(
      "某位作者",
    );
  });

  it("tolerates a backend that has not shipped the fields yet", () => {
    // Additive fields: the frontend must be deployable ahead of the server.
    expect(momentAuthorLabel(makeMoment())).toBe("某位作者");
  });

  it("never prints the raw authorId", () => {
    // An opaque id tells the reader nothing; showing it would be worse than
    // showing a neutral label.
    const label = momentAuthorLabel(makeMoment({ authorId: "u-9f3a2b" }));
    expect(label).not.toContain("u-9f3a2b");
  });
});
