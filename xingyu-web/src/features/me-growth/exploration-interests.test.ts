import { describe, expect, it } from "vitest";
import type { ExploreDomain, UserExplore } from "@/api/exploration/exploration.types";
import {
  MAX_CUSTOM_LABELS,
  MAX_CUSTOM_LABEL_LENGTH,
  slugifyLabel,
} from "@/api/exploration/exploration.types";
import {
  addLabel,
  dedupeLabels,
  domainChipLabel,
  flattenSelectableDomains,
  hasSelectableDomains,
  isDirty,
  personalLabels,
  removeLabel,
  selectedOfficialIds,
  toggleId,
} from "./exploration-interests";

function domain(over: Partial<ExploreDomain> = {}): ExploreDomain {
  return {
    id: "d1",
    slug: "tech",
    name: "技术",
    domainType: "SYSTEM",
    personal: false,
    children: [],
    ...over,
  };
}

const MAP: ExploreDomain[] = [
  domain({
    id: "root-tech",
    slug: "tech",
    name: "技术",
    children: [
      domain({ id: "c-java", slug: "java", name: "Java", description: "JVM 生态" }),
      domain({ id: "c-fe", slug: "frontend", name: "前端", description: "Web 界面" }),
    ],
  }),
  domain({
    id: "root-design",
    slug: "design",
    name: "设计",
    children: [domain({ id: "c-ui", slug: "ui", name: "UI", description: null })],
  }),
];

describe("flattenSelectableDomains", () => {
  it("flattens to CHILDREN only, carrying the parent group name", () => {
    const flat = flattenSelectableDomains(MAP);
    expect(flat.map((d) => d.id)).toEqual(["c-java", "c-fe", "c-ui"]);
    expect(flat[0]).toEqual({
      id: "c-java",
      name: "Java",
      groupName: "技术",
      description: "JVM 生态",
    });
    expect(flat[2].groupName).toBe("设计");
  });

  it("does NOT promote a childless root to a selectable leaf", () => {
    const flat = flattenSelectableDomains([domain({ id: "lonely", name: "孤儿根", children: [] })]);
    expect(flat).toEqual([]);
  });

  it("treats a null/absent children list as empty rather than crashing", () => {
    expect(flattenSelectableDomains([domain({ children: null })])).toEqual([]);
    expect(flattenSelectableDomains([{ id: "x", slug: "x", name: "X" }])).toEqual([]);
  });
});

describe("hasSelectableDomains", () => {
  it("is false for an empty map and for a roots-only map", () => {
    expect(hasSelectableDomains([])).toBe(false);
    expect(hasSelectableDomains([domain({ children: [] })])).toBe(false);
  });

  it("is true once at least one child exists", () => {
    expect(hasSelectableDomains(MAP)).toBe(true);
  });
});

describe("selectedOfficialIds", () => {
  it("filters OUT personal entries so a personal label is never a checked official box", () => {
    const mine: UserExplore = {
      domains: [
        domain({ id: "c-java" }),
        domain({ id: "p-1", name: "Java", personal: true, domainType: "PERSONAL" }),
      ],
      customLabels: ["Java"],
    };
    expect(selectedOfficialIds(mine)).toEqual(["c-java"]);
  });

  it("returns [] for a null response", () => {
    expect(selectedOfficialIds(null)).toEqual([]);
  });
});

describe("personalLabels", () => {
  it("prefers the server-derived customLabels", () => {
    const mine: UserExplore = {
      domains: [domain({ id: "p-1", name: "逆向研究", personal: true })],
      customLabels: ["逆向研究"],
    };
    expect(personalLabels(mine)).toEqual(["逆向研究"]);
  });

  it("falls back to personal domains when customLabels is absent, and de-dupes", () => {
    const mine = {
      domains: [
        domain({ id: "p-1", name: "逆向研究", personal: true }),
        domain({ id: "p-2", name: "逆向研究", personal: true }),
      ],
      customLabels: undefined as unknown as string[],
    };
    expect(personalLabels(mine)).toEqual(["逆向研究"]);
  });

  it("returns [] for null", () => {
    expect(personalLabels(null)).toEqual([]);
  });
});

describe("dedupeLabels", () => {
  it("trims, drops blanks, de-dupes case-insensitively, keeps first spelling + order", () => {
    expect(dedupeLabels([" Java ", "java", "", "  ", "Rust", "RUST"])).toEqual(["Java", "Rust"]);
  });
});

describe("addLabel", () => {
  it("appends a trimmed label", () => {
    const result = addLabel([], "  Java  ");
    expect(result).toEqual({ ok: true, labels: ["Java"] });
  });

  it("rejects an empty / whitespace-only label", () => {
    const result = addLabel([], "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty");
      expect(result.message).toContain("请输入");
    }
  });

  it("rejects a too-long label and names the limit", () => {
    const result = addLabel([], "x".repeat(MAX_CUSTOM_LABEL_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_long");
      expect(result.message).toContain(String(MAX_CUSTOM_LABEL_LENGTH));
    }
  });

  it("accepts a label exactly at the limit", () => {
    const result = addLabel([], "x".repeat(MAX_CUSTOM_LABEL_LENGTH));
    expect(result.ok).toBe(true);
  });

  it("rejects a duplicate case-insensitively", () => {
    const result = addLabel(["Java"], "java");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("duplicate");
  });

  it("rejects once the cap is reached", () => {
    const full = Array.from({ length: MAX_CUSTOM_LABELS }, (_, i) => `标签${i}`);
    const result = addLabel(full, "再一个");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_many");
      expect(result.message).toContain(String(MAX_CUSTOM_LABELS));
    }
  });

  it("does not mutate the input array", () => {
    const current = ["A"];
    addLabel(current, "B");
    expect(current).toEqual(["A"]);
  });
});

describe("removeLabel / toggleId", () => {
  it("removes by exact value", () => {
    expect(removeLabel(["A", "B", "C"], "B")).toEqual(["A", "C"]);
  });

  it("is a no-op for an unknown value", () => {
    expect(removeLabel(["A"], "Z")).toEqual(["A"]);
  });

  it("toggles an id on and off", () => {
    expect(toggleId([], "x")).toEqual(["x"]);
    expect(toggleId(["x", "y"], "x")).toEqual(["y"]);
  });
});

describe("isDirty", () => {
  const base = { domainIds: ["a", "b"], labels: ["Java"] };

  it("is false for identical state", () => {
    expect(isDirty(base, { domainIds: ["a", "b"], labels: ["Java"] })).toBe(false);
  });

  it("is false when only the DOMAIN ORDER differs (selection is a set)", () => {
    expect(isDirty(base, { domainIds: ["b", "a"], labels: ["Java"] })).toBe(false);
  });

  it("is TRUE when the LABEL order differs (order is user-visible)", () => {
    expect(
      isDirty({ domainIds: [], labels: ["A", "B"] }, { domainIds: [], labels: ["B", "A"] }),
    ).toBe(true);
  });

  it("detects an added / removed domain", () => {
    expect(isDirty(base, { domainIds: ["a"], labels: ["Java"] })).toBe(true);
    expect(isDirty(base, { domainIds: ["a", "b", "c"], labels: ["Java"] })).toBe(true);
  });

  it("detects an added / removed label", () => {
    expect(isDirty(base, { domainIds: ["a", "b"], labels: [] })).toBe(true);
    expect(isDirty(base, { domainIds: ["a", "b"], labels: ["Java", "Rust"] })).toBe(true);
  });

  it("detects a same-length but different domain set", () => {
    expect(isDirty(base, { domainIds: ["a", "z"], labels: ["Java"] })).toBe(true);
  });
});

describe("domainChipLabel", () => {
  it("prefers the name", () => {
    expect(domainChipLabel(domain({ name: "Java" }))).toBe("Java");
  });

  it("falls back to the slug when the name is blank", () => {
    expect(domainChipLabel(domain({ name: "  ", slug: "java" }))).toBe("java");
  });

  it("falls back to a literal marker when name and slug are both blank", () => {
    expect(domainChipLabel(domain({ name: "", slug: "" }))).toBe("未命名领域");
  });
});

describe("slugifyLabel (mirrors the server's slugify)", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyLabel("My New Label")).toBe("my-new-label");
  });

  it("keeps CJK characters", () => {
    expect(slugifyLabel("逆向研究")).toBe("逆向研究");
  });

  it("collapses repeated separators and trims the edges", () => {
    expect(slugifyLabel("  a---b!!c  ")).toBe("a-b-c");
  });
});
