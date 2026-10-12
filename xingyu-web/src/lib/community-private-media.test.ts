import { describe, expect, it } from "vitest";
import { parseCommunityPrivateMediaPath } from "@/lib/community-private-media";

describe("parseCommunityPrivateMediaPath", () => {
  it("accepts only same-origin root-relative private media paths", () => {
    expect(parseCommunityPrivateMediaPath("/api/v1/media/private/42")).toBe(
      "/api/v1/media/private/42",
    );
  });

  it("rejects absolute and protocol-relative URLs even when the path looks similar", () => {
    expect(
      parseCommunityPrivateMediaPath("https://evil.example/api/v1/media/private/1"),
    ).toBeNull();
    expect(parseCommunityPrivateMediaPath("//evil.example/api/v1/media/private/1")).toBeNull();
    expect(parseCommunityPrivateMediaPath("http://localhost/api/v1/media/private/1")).toBeNull();
  });

  it("rejects path suffix tricks and query-string token injection targets", () => {
    expect(parseCommunityPrivateMediaPath("/api/v1/media/private/1?satoken=leak")).toBe(
      "/api/v1/media/private/1",
    );
    expect(parseCommunityPrivateMediaPath("/evil/api/v1/media/private/1")).toBeNull();
    expect(parseCommunityPrivateMediaPath("/api/v1/media/private/not-a-number")).toBeNull();
    expect(parseCommunityPrivateMediaPath("/api/v1/media/private/1/extra")).toBeNull();
  });

  it("does not treat substring matches inside unrelated strings as private media", () => {
    expect(
      parseCommunityPrivateMediaPath("https://cdn.test/photo.png?x=/api/v1/media/private/99"),
    ).toBeNull();
  });
});
