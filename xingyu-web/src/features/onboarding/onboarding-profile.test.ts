import { describe, expect, it } from "vitest";
import { buildOnboardingProfilePatch } from "./onboarding-profile";

describe("buildOnboardingProfilePatch", () => {
  const baseline = { displayName: "alice", bio: "" };

  it("returns null when nothing changed", () => {
    expect(buildOnboardingProfilePatch(2, baseline, baseline)).toBeNull();
  });

  it("omits empty strings so a clear is never submitted", () => {
    expect(
      buildOnboardingProfilePatch(
        2,
        { displayName: "alice", bio: "简介" },
        { displayName: "", bio: "" },
      ),
    ).toBeNull();
  });

  it("sends only the non-empty changed fields plus lockVersion", () => {
    expect(
      buildOnboardingProfilePatch(4, baseline, { displayName: "探针昵称", bio: "探针简介" }),
    ).toEqual({
      lockVersion: 4,
      displayName: "探针昵称",
      bio: "探针简介",
    });
  });

  it("does not send an unchanged field", () => {
    expect(
      buildOnboardingProfilePatch(1, baseline, { displayName: "alice", bio: "新简介" }),
    ).toEqual({ lockVersion: 1, bio: "新简介" });
  });
});
