import { describe, expect, it } from "vitest";
import {
  SUBMISSION_OBJECT_LABELS,
  eventCountdown,
  formatEventDateTime,
  formatEventDay,
  isEventEnded,
  isSubmissionAccepted,
  isSubmissionSettled,
  submissionStatusLabel,
  type EventView,
} from "./events.types";

/*
 * Derivations for the events domain (Phase 2I-4).
 *
 * The load-bearing distinction this file pins: `submissionOpen` is NOT a proxy
 * for "the event is over". An admin closes submissions independently of
 * `endsAt`, so `isEventEnded` reads the timestamp and nothing else.
 */

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "e1",
    slug: "starry",
    title: "星语活动",
    body: "活动说明",
    startsAt: "2026-09-27T02:00:00Z",
    endsAt: "2026-09-30T02:00:00Z",
    submissionOpen: true,
    ...overrides,
  };
}

const NOW = new Date("2026-09-28T02:00:00Z").getTime();

describe("submissionStatusLabel", () => {
  it("maps the review states", () => {
    expect(submissionStatusLabel("SUBMITTED")).toBe("已投稿");
    expect(submissionStatusLabel("ACCEPTED")).toBe("已通过");
    expect(submissionStatusLabel("REJECTED")).toBe("未通过");
  });

  it("treats APPROVED and DISMISSED as the aliases the service normalizes to", () => {
    // normalizeReviewStatus folds APPROVED->ACCEPTED / DISMISSED->REJECTED, but
    // a row written before that normalization (or straight to the DB) can carry
    // the old spelling — the label must not fall through to the raw string.
    expect(submissionStatusLabel("APPROVED")).toBe("已通过");
  });

  it("is case-insensitive", () => {
    expect(submissionStatusLabel("submitted")).toBe("已投稿");
  });

  it("passes an unknown status through rather than inventing a label", () => {
    expect(submissionStatusLabel("WEIRD")).toBe("WEIRD");
  });

  it("does not throw on an empty status", () => {
    expect(submissionStatusLabel("")).toBe("");
  });
});

describe("isSubmissionSettled / isSubmissionAccepted", () => {
  it("treats only reviewed rows as settled", () => {
    expect(isSubmissionSettled("SUBMITTED")).toBe(false);
    expect(isSubmissionSettled("PENDING")).toBe(false);
    expect(isSubmissionSettled("ACCEPTED")).toBe(true);
    expect(isSubmissionSettled("REJECTED")).toBe(true);
  });

  it("counts ACCEPTED/APPROVED as accepted, and a rejection as not", () => {
    expect(isSubmissionAccepted("ACCEPTED")).toBe(true);
    expect(isSubmissionAccepted("APPROVED")).toBe(true);
    expect(isSubmissionAccepted("REJECTED")).toBe(false);
    expect(isSubmissionAccepted("SUBMITTED")).toBe(false);
  });
});

describe("SUBMISSION_OBJECT_LABELS", () => {
  it("covers exactly the three submittable types", () => {
    expect(Object.keys(SUBMISSION_OBJECT_LABELS).sort()).toEqual(["ARTICLE", "MOMENT", "SERIES"]);
  });
});

describe("formatEventDateTime", () => {
  it("formats in Asia/Shanghai regardless of the runner timezone", () => {
    // 02:00 UTC on the 27th == 10:00 CST.
    expect(formatEventDateTime("2026-09-27T02:00:00Z")).toContain("2026");
    expect(formatEventDateTime("2026-09-27T02:00:00Z")).toContain("10:00");
  });

  it("returns null for missing or unparseable input, never 'Invalid Date'", () => {
    expect(formatEventDateTime(null)).toBeNull();
    expect(formatEventDateTime(undefined)).toBeNull();
    expect(formatEventDateTime("garbage")).toBeNull();
  });
});

describe("formatEventDay", () => {
  it("returns MM/DD in CST", () => {
    expect(formatEventDay("2026-09-27T02:00:00Z")).toBe("09/27");
  });

  it("handles the CST day boundary — late UTC is the next day in Shanghai", () => {
    // 16:30 UTC on the 27th is 00:30 on the 28th in Shanghai.
    expect(formatEventDay("2026-09-27T16:30:00Z")).toBe("09/28");
  });

  it("returns null when there is no usable date", () => {
    expect(formatEventDay(null)).toBeNull();
    expect(formatEventDay("nope")).toBeNull();
  });
});

describe("isEventEnded", () => {
  it("is false before the end", () => {
    expect(isEventEnded(event(), NOW)).toBe(false);
  });

  it("is true once the end has passed", () => {
    expect(isEventEnded(event({ endsAt: "2026-09-27T02:00:00Z" }), NOW)).toBe(true);
  });

  it("is true exactly at the end instant", () => {
    expect(isEventEnded(event({ endsAt: "2026-09-28T02:00:00Z" }), NOW)).toBe(true);
  });

  it("is null — not false — when the end time is unknown", () => {
    // "We do not know" must stay distinguishable from "still running".
    expect(isEventEnded(event({ endsAt: null }), NOW)).toBeNull();
    expect(isEventEnded(event({ endsAt: "garbage" }), NOW)).toBeNull();
  });

  it("IGNORES submissionOpen — a closed event is not a finished one", () => {
    // The trap this guards: submissions closed while the event still runs.
    const closedButRunning = event({ submissionOpen: false, endsAt: "2026-09-30T02:00:00Z" });
    expect(isEventEnded(closedButRunning, NOW)).toBe(false);

    const openButOver = event({ submissionOpen: true, endsAt: "2026-09-01T02:00:00Z" });
    expect(isEventEnded(openButOver, NOW)).toBe(true);
  });
});

describe("eventCountdown", () => {
  it("counts days and hours down to the end", () => {
    // NOW is 2026-09-28 02:00Z, end is 2026-09-30 02:00Z => 48h => 2 天 00 小时.
    expect(eventCountdown(event(), NOW)).toBe("2 天 00 小时");
  });

  it("drops the day part under a day", () => {
    expect(eventCountdown(event({ endsAt: "2026-09-28T12:00:00Z" }), NOW)).toBe("10 小时");
  });

  it("is null once the end has passed, so the caller writes its own copy", () => {
    expect(eventCountdown(event({ endsAt: "2026-09-01T02:00:00Z" }), NOW)).toBeNull();
  });

  it("is null when the end is unknown", () => {
    expect(eventCountdown(event({ endsAt: null }), NOW)).toBeNull();
    expect(eventCountdown(event({ endsAt: "nope" }), NOW)).toBeNull();
  });
});
