import { describe, expect, it } from "vitest";
import type { TopicSummary } from "@/api/topics/topics.types";
import {
  creatorDisplayName,
  creatorInitial,
  filterCreators,
  mergeCreatorRows,
  type CreatorCard,
} from "./creator-card";

function topic(id: string, name: string): TopicSummary {
  return { id, name, slug: name.toLowerCase() };
}

function card(overrides: Partial<CreatorCard> & { username: string }): CreatorCard {
  return {
    contentCount: 0,
    profile: null,
    latestWork: null,
    topics: [],
    ...overrides,
  };
}

describe("mergeCreatorRows", () => {
  it("merges the same username found under two topics into one card", () => {
    const merged = mergeCreatorRows([
      { topic: topic("t1", "星语"), creators: [{ username: "alice", contentCount: 3 }] },
      { topic: topic("t2", "写作"), creators: [{ username: "alice", contentCount: 5 }] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].topics).toEqual(["星语", "写作"]);
  });

  it("takes the MAX contentCount rather than summing it", () => {
    // Per-topic contentCount is the creator's TOTAL published content, so
    // summing would double count the same works.
    const merged = mergeCreatorRows([
      { topic: topic("t1", "星语"), creators: [{ username: "alice", contentCount: 3 }] },
      { topic: topic("t2", "写作"), creators: [{ username: "alice", contentCount: 5 }] },
    ]);
    expect(merged[0].contentCount).toBe(5);
  });

  it("keeps first-seen order of usernames", () => {
    const merged = mergeCreatorRows([
      {
        topic: topic("t1", "星语"),
        creators: [
          { username: "alice", contentCount: 1 },
          { username: "bob", contentCount: 1 },
        ],
      },
      { topic: topic("t2", "写作"), creators: [{ username: "carol", contentCount: 1 }] },
    ]);
    expect(merged.map((row) => row.username)).toEqual(["alice", "bob", "carol"]);
  });

  it("does not duplicate a topic name when the creator repeats within it", () => {
    const merged = mergeCreatorRows([
      {
        topic: topic("t1", "星语"),
        creators: [
          { username: "alice", contentCount: 1 },
          { username: "alice", contentCount: 2 },
        ],
      },
    ]);
    expect(merged[0].topics).toEqual(["星语"]);
  });

  it("backfills a displayName that only a later topic row carries", () => {
    const merged = mergeCreatorRows([
      { topic: topic("t1", "星语"), creators: [{ username: "alice", contentCount: 1 }] },
      {
        topic: topic("t2", "写作"),
        creators: [{ username: "alice", contentCount: 1, displayName: "爱丽丝" }],
      },
    ]);
    expect(merged[0].displayName).toBe("爱丽丝");
  });

  it("returns an empty array for no rows", () => {
    expect(mergeCreatorRows([])).toEqual([]);
  });
});

describe("filterCreators", () => {
  const rows = [
    card({ username: "alice", displayName: "爱丽丝", topics: ["星语", "写作"] }),
    card({ username: "bob", displayName: "鲍勃", topics: ["星语"] }),
  ];

  it("returns everything for ALL with an empty query", () => {
    expect(filterCreators(rows, "ALL", "").map((r) => r.username)).toEqual(["alice", "bob"]);
  });

  it("filters by topic name", () => {
    expect(filterCreators(rows, "写作", "").map((r) => r.username)).toEqual(["alice"]);
  });

  it("matches the query against displayName", () => {
    expect(filterCreators(rows, "ALL", "鲍勃").map((r) => r.username)).toEqual(["bob"]);
  });

  it("matches the query against username", () => {
    expect(filterCreators(rows, "ALL", "ALI").map((r) => r.username)).toEqual(["alice"]);
  });

  it("matches the query against topic names", () => {
    // Legacy searched topics too — keep that behaviour.
    expect(filterCreators(rows, "ALL", "写作").map((r) => r.username)).toEqual(["alice"]);
  });

  it("combines topic filter and query", () => {
    expect(filterCreators(rows, "星语", "bob").map((r) => r.username)).toEqual(["bob"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterCreators(rows, "ALL", "zzz")).toEqual([]);
  });

  it("trims the query before matching", () => {
    expect(filterCreators(rows, "ALL", "  bob  ").map((r) => r.username)).toEqual(["bob"]);
  });
});

describe("creatorDisplayName", () => {
  it("prefers the profile displayName", () => {
    expect(
      creatorDisplayName(
        card({ username: "alice", displayName: "行内名", profile: { username: "alice", displayName: "档案名" } })
      )
    ).toBe("档案名");
  });

  it("falls back to the summary displayName when the profile is missing", () => {
    expect(creatorDisplayName(card({ username: "alice", displayName: "行内名" }))).toBe("行内名");
  });

  it("falls back to the username as a last resort", () => {
    expect(creatorDisplayName(card({ username: "alice" }))).toBe("alice");
  });

  it("treats an empty profile displayName as absent", () => {
    // An empty string is not a name — showing "" would render a blank heading.
    expect(
      creatorDisplayName(
        card({ username: "alice", displayName: "行内名", profile: { username: "alice", displayName: "" } })
      )
    ).toBe("行内名");
  });
});

describe("creatorInitial", () => {
  it("uppercases the first character", () => {
    expect(creatorInitial(card({ username: "alice" }))).toBe("A");
  });

  it("uses the display name when present", () => {
    expect(creatorInitial(card({ username: "alice", displayName: "bob" }))).toBe("B");
  });

  it("returns an empty string for an empty name rather than throwing", () => {
    expect(creatorInitial(card({ username: "" }))).toBe("");
  });
});
