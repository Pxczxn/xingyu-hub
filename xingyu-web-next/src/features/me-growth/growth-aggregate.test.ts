import { describe, expect, it } from "vitest";
import type { PendingAction } from "@/api/home/home.types";
import {
  KNOWN_PENDING_ROUTES,
  dedupePendingActions,
  pendingCountLabel,
  pendingKey,
  pendingTitle,
  resolvePendingHref,
} from "./growth-aggregate";

function action(overrides: Partial<PendingAction> = {}): PendingAction {
  return { type: "REVIEW", title: "文章审核中", href: "/studio/reviewing", ...overrides };
}

describe("resolvePendingHref", () => {
  it("refuses the backend's real href, because V2 has no /studio/reviewing", () => {
    // HomeService:84 hardcodes this path. It is real server data and a real 404.
    expect(resolvePendingHref(action())).toBeNull();
  });

  it("accepts a known route", () => {
    expect(resolvePendingHref(action({ href: "/studio/submissions" }))).toBe("/studio/submissions");
  });

  it("normalises a trailing slash", () => {
    expect(resolvePendingHref(action({ href: "/studio/" }))).toBe("/studio");
  });

  it("treats an empty or missing href as no link", () => {
    expect(resolvePendingHref(action({ href: "" }))).toBeNull();
    expect(resolvePendingHref(action({ href: "   " }))).toBeNull();
    expect(resolvePendingHref({} as PendingAction)).toBeNull();
  });

  it("does not accept a route merely because it starts with /studio", () => {
    // An allowlist, not a prefix heuristic.
    expect(resolvePendingHref(action({ href: "/studio/does-not-exist" }))).toBeNull();
  });

  it("only allows routes that are actually shipped", () => {
    // Guards the allowlist itself against someone adding a speculative entry.
    expect(KNOWN_PENDING_ROUTES).not.toContain("/studio/reviewing");
  });
});

describe("pendingTitle", () => {
  it("prefers the server title", () => {
    expect(pendingTitle(action({ title: "文章审核中" }))).toBe("文章审核中");
  });

  it("echoes the raw type when there is no title, rather than translating", () => {
    // Same containment rule as §三·补4: an unknown enum stays visible.
    expect(pendingTitle(action({ type: "BRAND_NEW", title: "" }))).toBe("BRAND_NEW");
  });

  it("falls back when both are blank", () => {
    expect(pendingTitle({} as PendingAction)).toBe("待处理事项");
  });
});

describe("pendingKey", () => {
  it("produces a key without needing a (non-existent) id", () => {
    // PendingActionView has no `id` field — the record is (type,title,href).
    expect(pendingKey(action(), 0)).toBe("REVIEW|文章审核中|/studio/reviewing|0");
  });

  it("distinguishes identical actions by index", () => {
    expect(pendingKey(action(), 0)).not.toBe(pendingKey(action(), 1));
  });
});

describe("dedupePendingActions", () => {
  it("collapses the server's per-article duplicates into one row", () => {
    // One REVIEW row per under-review article — 3 articles, 3 identical rows.
    const { actions, counts } = dedupePendingActions([action(), action(), action()]);
    expect(actions).toHaveLength(1);
    expect(counts.get(pendingKey(action(), 0))).toBe(3);
    expect(pendingCountLabel(3)).toBe("3 项");
  });

  it("keeps genuinely different actions", () => {
    const { actions } = dedupePendingActions([
      action(),
      action({ type: "OTHER", title: "别的事", href: "/reports" }),
    ]);
    expect(actions).toHaveLength(2);
  });

  it("is a no-op for an empty list", () => {
    const { actions, counts } = dedupePendingActions([]);
    expect(actions).toEqual([]);
    expect(counts.size).toBe(0);
  });

  it("labels a single occurrence with no count", () => {
    const { counts } = dedupePendingActions([action()]);
    expect(counts.get(pendingKey(action(), 0))).toBe(1);
    expect(pendingCountLabel(1)).toBe("");
  });
});
