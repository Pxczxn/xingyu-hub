import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DEACTIVATION_WARNING,
  checkNewEmail,
  checkPasswordForReauth,
  dataExportFilename,
  emailChangeNotice,
  exportSections,
  recentAuthNotice,
} from "./account-security";

describe("checkNewEmail", () => {
  it("rejects an empty value", () => {
    expect(checkNewEmail("", "old@pxczxn.top").ok).toBe(false);
    expect(checkNewEmail("   ", "old@pxczxn.top").ok).toBe(false);
  });

  it("rejects a malformed address", () => {
    expect(checkNewEmail("not-an-email", null).ok).toBe(false);
    expect(checkNewEmail("a@b", null).ok).toBe(false);
    expect(checkNewEmail("@pxczxn.top", null).ok).toBe(false);
  });

  it("accepts a well-formed address", () => {
    expect(checkNewEmail("new@pxczxn.top", "old@pxczxn.top").ok).toBe(true);
  });

  it("rejects the address already in use, case-insensitively", () => {
    // The backend 400s on this; catching it locally saves a round trip.
    expect(checkNewEmail("old@pxczxn.top", "old@pxczxn.top").ok).toBe(false);
    expect(checkNewEmail("OLD@PXCZXN.TOP", "old@pxczxn.top").ok).toBe(false);
    expect(checkNewEmail(" old@pxczxn.top ", "old@pxczxn.top").ok).toBe(false);
  });

  it("allows any address when the current email is unknown", () => {
    expect(checkNewEmail("new@pxczxn.top", null).ok).toBe(true);
    expect(checkNewEmail("new@pxczxn.top", undefined).ok).toBe(true);
  });

  it("trims before validating", () => {
    expect(checkNewEmail("  new@pxczxn.top  ", null).ok).toBe(true);
  });
});

describe("checkPasswordForReauth", () => {
  it("requires a non-empty password", () => {
    expect(checkPasswordForReauth("").ok).toBe(false);
  });

  it("accepts any non-empty password without length rules", () => {
    // Re-auth verifies an EXISTING password; length policy belongs to set-time.
    // Applying a min-length rule here would lock out accounts with older passwords.
    expect(checkPasswordForReauth("x").ok).toBe(true);
    expect(checkPasswordForReauth("whatever").ok).toBe(true);
  });
});

describe("emailChangeNotice", () => {
  it("reports a warning when the confirmation mail could NOT be sent", () => {
    const notice = emailChangeNotice({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: false,
    });
    // HTTP 200 but functionally a failure — must not read as success.
    expect(notice.tone).toBe("warning");
    expect(notice.message).toContain("暂未成功投递");
    expect(notice.message).toContain("old@pxczxn.top");
  });

  it("reports success and states that the old email is still in effect", () => {
    const notice = emailChangeNotice({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: true,
    });
    expect(notice.tone).toBe("success");
    expect(notice.message).toContain("new@pxczxn.top");
    // Critical: must not imply the change already happened.
    expect(notice.message).toContain("完成确认后新邮箱才会生效");
    expect(notice.message).toContain("old@pxczxn.top");
  });
});

describe("recentAuthNotice", () => {
  it("states the password requirement and the 15-minute window", () => {
    expect(recentAuthNotice()).toContain("当前密码");
    expect(recentAuthNotice()).toContain("15 分钟");
  });
});

describe("ACCOUNT_DEACTIVATION_WARNING", () => {
  it("says 停用 rather than promising deletion", () => {
    // The backend only sets SUSPENDED; promising "delete" would be a lie.
    expect(ACCOUNT_DEACTIVATION_WARNING).toContain("停用");
    expect(ACCOUNT_DEACTIVATION_WARNING).not.toContain("永久删除");
  });

  it("warns there is no self-service way back", () => {
    expect(ACCOUNT_DEACTIVATION_WARNING).toContain("没有提供自助恢复入口");
  });
});

describe("dataExportFilename", () => {
  it("builds a dated .json filename", () => {
    expect(dataExportFilename(new Date("2026-09-28T10:00:00Z"))).toBe(
      "xingyu-data-export-20260928.json",
    );
  });

  it("zero-pads month and day", () => {
    expect(dataExportFilename(new Date(2026, 0, 5))).toBe("xingyu-data-export-20260105.json");
  });
});

describe("exportSections", () => {
  it("labels the sections the backend actually sends, in payload order", () => {
    const sections = exportSections({
      exportedAt: "2026-09-28T10:00:00Z",
      profile: { username: "tester" },
      articles: [{}, {}],
      likes: [{}],
    });
    expect(sections.map((s) => s.key)).toEqual(["exportedAt", "profile", "articles", "likes"]);
    expect(sections.find((s) => s.key === "articles")?.count).toBe(2);
    expect(sections.find((s) => s.key === "likes")?.count).toBe(1);
  });

  it("reports null count for non-array sections", () => {
    const sections = exportSections({ profile: { username: "x" } });
    expect(sections[0].count).toBeNull();
  });

  it("echoes an unexpected key rather than dropping it", () => {
    // If the server adds a section, the preview must show it, not hide it.
    const sections = exportSections({ somethingNew: [] });
    expect(sections[0].label).toBe("somethingNew");
    expect(sections[0].count).toBe(0);
  });

  it("handles an empty payload", () => {
    expect(exportSections({})).toEqual([]);
  });
});
