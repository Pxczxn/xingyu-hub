import { describe, expect, it } from "vitest";
import type { BadgeView } from "@/api/badges/badges.types";
import { KNOWN_BADGE_IDS } from "@/api/badges/badges.types";
import {
  badgeDescription,
  badgeTitle,
  badgeTone,
  countEarned,
  hasUnknownBadges,
  isEarned,
  sortForDisplay,
} from "./achievement-badges";

function badge(overrides: Partial<BadgeView> = {}): BadgeView {
  return {
    id: "onboard",
    title: "入门完成",
    description: "完成入门引导",
    earned: false,
    ...overrides,
  };
}

describe("badgeTone", () => {
  it("maps true to earned", () => {
    expect(badgeTone(badge({ earned: true }))).toBe("earned");
  });

  it("maps false to locked", () => {
    expect(badgeTone(badge({ earned: false }))).toBe("locked");
  });

  it("does NOT silently treat a non-boolean as locked", () => {
    // A future shape change must be visible, not rendered as "not yet earned".
    const weird = { earned: "yes" } as unknown as Pick<BadgeView, "earned">;
    expect(badgeTone(weird)).toBe("unknown");
  });
});

describe("isEarned", () => {
  it("is strictly true-based", () => {
    expect(isEarned(badge({ earned: true }))).toBe(true);
    expect(isEarned(badge({ earned: false }))).toBe(false);
  });

  it("treats a truthy non-boolean as not earned", () => {
    const weird = { earned: 1 } as unknown as Pick<BadgeView, "earned">;
    expect(isEarned(weird)).toBe(false);
  });
});

describe("badgeTitle", () => {
  it("uses the server title", () => {
    expect(badgeTitle(badge({ title: "社区之星" }))).toBe("社区之星");
  });

  it("falls back to the known-id label when the title is blank", () => {
    expect(badgeTitle(badge({ id: "prolific", title: "  " }))).toBe("勤耕不辍");
  });

  it("falls back to the raw id for an unknown badge", () => {
    expect(badgeTitle(badge({ id: "brand-new", title: "" }))).toBe("brand-new");
  });

  it("never returns an empty string", () => {
    expect(badgeTitle({ id: "", title: "" })).toBe("未命名徽章");
  });
});

describe("badgeDescription", () => {
  it("keeps the server's criterion text for a locked badge", () => {
    // The criterion is the instruction — do not replace it with generic copy.
    expect(badgeDescription(badge({ description: "粉丝达到 10", earned: false }))).toBe(
      "粉丝达到 10",
    );
  });

  it("supplies a fallback only when the server sent nothing", () => {
    expect(badgeDescription(badge({ description: "", earned: true }))).toBe("已点亮这份成就。");
    expect(badgeDescription(badge({ description: "", earned: false }))).toBe(
      "继续参与社区即可解锁。",
    );
  });
});

describe("countEarned", () => {
  it("counts only strictly-true badges", () => {
    expect(
      countEarned([
        badge({ id: "a", earned: true }),
        badge({ id: "b", earned: false }),
        badge({ id: "c", earned: true }),
      ]),
    ).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(countEarned([])).toBe(0);
  });
});

describe("sortForDisplay", () => {
  it("puts earned first and keeps the server order within each group", () => {
    const input = [
      badge({ id: "onboard", earned: false }),
      badge({ id: "first-post", earned: true }),
      badge({ id: "prolific", earned: false }),
      badge({ id: "social", earned: true }),
    ];
    expect(sortForDisplay(input).map((b) => b.id)).toEqual([
      "first-post",
      "social",
      "onboard",
      "prolific",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [badge({ id: "a", earned: false }), badge({ id: "b", earned: true })];
    const snapshot = input.map((b) => b.id);
    sortForDisplay(input);
    expect(input.map((b) => b.id)).toEqual(snapshot);
  });

  it("is stable when nothing is earned", () => {
    const input = KNOWN_BADGE_IDS.map((id) => badge({ id, earned: false }));
    expect(sortForDisplay(input).map((b) => b.id)).toEqual([...KNOWN_BADGE_IDS]);
  });
});

describe("hasUnknownBadges", () => {
  it("is false for the known five", () => {
    expect(hasUnknownBadges(KNOWN_BADGE_IDS.map((id) => badge({ id })))).toBe(false);
  });

  it("is true when the backend added an id we do not know", () => {
    expect(
      hasUnknownBadges([...KNOWN_BADGE_IDS.map((id) => badge({ id })), badge({ id: "new" })]),
    ).toBe(true);
  });

  it("is false for an empty list", () => {
    expect(hasUnknownBadges([])).toBe(false);
  });
});
