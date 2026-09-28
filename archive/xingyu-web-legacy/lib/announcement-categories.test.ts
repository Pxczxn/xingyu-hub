import { describe, expect, it } from "vitest";
import {
  classifyAnnouncement,
  countAnnouncementsByCategory,
  filterAnnouncements,
} from "@/lib/announcement-categories";

describe("announcement categories", () => {
  it("classifies announcements by keywords", () => {
    expect(
      classifyAnnouncement({ id: "1", title: "社区行为规范更新公告", body: "请遵守社区规范" }),
    ).toBe("RULES");
    expect(
      classifyAnnouncement({ id: "2", title: "3.2 版本更新说明", body: "本次上线新功能" }),
    ).toBe("UPDATE");
  });

  it("filters by tab and query", () => {
    const items = [
      { id: "1", title: "社区规则调整", body: "规范更新" },
      { id: "2", title: "春季活动开启", body: "欢迎报名" },
    ];

    expect(filterAnnouncements(items, "RULES", "").map((item) => item.id)).toEqual(["1"]);
    expect(filterAnnouncements(items, "ALL", "活动").map((item) => item.id)).toEqual(["2"]);
  });

  it("counts categories", () => {
    const counts = countAnnouncementsByCategory([
      { id: "1", title: "社区规则调整", body: "" },
      { id: "2", title: "日常说明", body: "普通通知" },
    ]);

    expect(counts.ALL).toBe(2);
    expect(counts.RULES).toBe(1);
    expect(counts.EVENT).toBe(0);
  });
});
