import { beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingApi } from "@/api/onboarding/onboarding.api";
import {
  buildOnboardingPath,
  resolveOnboardingExitPath,
  resolvePostLoginPath,
  shouldSkipOnboardingGate,
} from "@/features/onboarding/post-login-routing";

vi.mock("@/api/onboarding/onboarding.api", () => ({
  onboardingApi: { get: vi.fn(), update: vi.fn() },
}));

const mockedGet = vi.mocked(onboardingApi.get);

beforeEach(() => {
  mockedGet.mockReset();
});

describe("shouldSkipOnboardingGate", () => {
  it("skips when returnTo is already the onboarding route", () => {
    expect(shouldSkipOnboardingGate("/onboarding")).toBe(true);
    expect(shouldSkipOnboardingGate("/onboarding?returnTo=%2Fstudio")).toBe(true);
  });

  it("skips auth screens so a login loop cannot form", () => {
    expect(shouldSkipOnboardingGate("/login")).toBe(true);
    expect(shouldSkipOnboardingGate("/register?registered=1")).toBe(true);
  });

  it("does not skip ordinary destinations", () => {
    expect(shouldSkipOnboardingGate("/")).toBe(false);
    expect(shouldSkipOnboardingGate("/studio")).toBe(false);
    expect(shouldSkipOnboardingGate("/me")).toBe(false);
  });
});

describe("buildOnboardingPath", () => {
  it("omits returnTo when the destination is already home", () => {
    expect(buildOnboardingPath("/")).toBe("/onboarding");
  });

  it("carries the original returnTo as a query so it is not lost", () => {
    expect(buildOnboardingPath("/studio")).toBe("/onboarding?returnTo=%2Fstudio");
  });
});

describe("resolveOnboardingExitPath", () => {
  it("returns home when returnTo is missing", () => {
    expect(resolveOnboardingExitPath(null)).toBe("/");
  });

  it("rejects open redirects and onboarding loops", () => {
    expect(resolveOnboardingExitPath("https://evil.example")).toBe("/");
    expect(resolveOnboardingExitPath("//evil.example")).toBe("/");
    expect(resolveOnboardingExitPath("/onboarding")).toBe("/");
  });

  it("returns the stored in-app path", () => {
    expect(resolveOnboardingExitPath("/studio")).toBe("/studio");
    expect(resolveOnboardingExitPath("/settings/profile")).toBe("/settings/profile");
  });
});

describe("resolvePostLoginPath", () => {
  it("does not fetch onboarding when the gate is skipped", async () => {
    await expect(resolvePostLoginPath("/onboarding")).resolves.toBe("/onboarding");
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("sends incomplete users to /onboarding and keeps returnTo", async () => {
    mockedGet.mockResolvedValue({
      step: "WELCOME",
      interestsJson: null,
      completed: false,
    });

    await expect(resolvePostLoginPath("/studio")).resolves.toBe("/onboarding?returnTo=%2Fstudio");
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("lets completed users through to the original returnTo", async () => {
    mockedGet.mockResolvedValue({
      step: "DONE",
      interestsJson: '["写作"]',
      completed: true,
    });

    await expect(resolvePostLoginPath("/me")).resolves.toBe("/me");
  });

  it("falls through to returnTo when GET onboarding fails", async () => {
    mockedGet.mockRejectedValue(new Error("network"));

    await expect(resolvePostLoginPath("/discover")).resolves.toBe("/discover");
  });
});
