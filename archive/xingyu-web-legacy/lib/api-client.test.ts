import { describe, expect, it } from "vitest";
import { resolveMediaUrl } from "./api-client";

describe("resolveMediaUrl", () => {
  it("rewrites legacy local file paths", () => {
    expect(resolveMediaUrl("/api/files/community/messages/a.png")).toBe(
      "/api/v1/admin/files/community/messages/a.png",
    );
  });

  it("keeps current admin file paths", () => {
    expect(resolveMediaUrl("/api/v1/admin/files/community/messages/a.png")).toBe(
      "/api/v1/admin/files/community/messages/a.png",
    );
  });

  it("keeps absolute urls", () => {
    expect(resolveMediaUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });
});
