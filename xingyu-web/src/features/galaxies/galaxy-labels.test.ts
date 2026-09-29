import { describe, expect, it } from "vitest";
import {
  GALAXY_CONTENT_FILTERS,
  formatJoinedAt,
  galaxyContentTypeLabel,
  galaxyKindLabel,
  galaxyMemberRoleLabel,
} from "./galaxy-labels";

describe("galaxyKindLabel", () => {
  it("maps official to 官方星系 and everything else to 社区星系", () => {
    expect(galaxyKindLabel(true)).toBe("官方星系");
    expect(galaxyKindLabel(false)).toBe("社区星系");
  });
});

describe("galaxyMemberRoleLabel", () => {
  it("translates the known enum values", () => {
    expect(galaxyMemberRoleLabel("OWNER")).toBe("创建者");
    expect(galaxyMemberRoleLabel("ADMIN")).toBe("管理员");
    expect(galaxyMemberRoleLabel("MEMBER")).toBe("成员");
  });

  it("is case-insensitive", () => {
    expect(galaxyMemberRoleLabel("owner")).toBe("创建者");
  });

  it("passes an unknown role through instead of hiding it", () => {
    expect(galaxyMemberRoleLabel("SUPERVISOR")).toBe("SUPERVISOR");
  });

  it("falls back to 成员 for null / empty input", () => {
    expect(galaxyMemberRoleLabel(null)).toBe("成员");
    expect(galaxyMemberRoleLabel("  ")).toBe("成员");
  });
});

describe("galaxyContentTypeLabel", () => {
  it("translates the object types the backend emits", () => {
    expect(galaxyContentTypeLabel("ARTICLE")).toBe("文章");
    expect(galaxyContentTypeLabel("SERIES")).toBe("系列");
    expect(galaxyContentTypeLabel("MOMENT")).toBe("动态");
    expect(galaxyContentTypeLabel("USER")).toBe("用户");
  });

  it("falls back to 内容 for a missing type", () => {
    expect(galaxyContentTypeLabel(null)).toBe("内容");
  });
});

describe("formatJoinedAt", () => {
  it("formats an ISO timestamp as a zh-CN date", () => {
    expect(formatJoinedAt("2026-09-27T10:00:00Z")).toMatch(/2026/);
  });

  it("explains a missing timestamp instead of printing an empty string", () => {
    expect(formatJoinedAt(null)).toBe("加入时间暂未提供");
    expect(formatJoinedAt(undefined)).toBe("加入时间暂未提供");
  });

  it("echoes a malformed value rather than printing Invalid Date", () => {
    expect(formatJoinedAt("not-a-date")).toBe("not-a-date");
  });
});

describe("GALAXY_CONTENT_FILTERS", () => {
  it("exposes the four filters the feed renders, starting unfiltered", () => {
    expect(GALAXY_CONTENT_FILTERS.map((item) => item.label)).toEqual([
      "全部",
      "文章",
      "系列",
      "动态",
    ]);
    expect(GALAXY_CONTENT_FILTERS[0].value).toBeNull();
  });
});
