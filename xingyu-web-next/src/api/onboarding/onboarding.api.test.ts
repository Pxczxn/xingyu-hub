import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { onboardingApi } from "@/api/onboarding/onboarding.api";

/*
 * Phase 2A-3: the ONLY wrappers for /me/onboarding. Path + method are the
 * contract (verified live 2026-09-24). Patch is partial merge; the UI must
 * send only keys it intends to change and must never send interestsJson: null.
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("onboardingApi", () => {
  it("reads GET /api/v1/me/onboarding", async () => {
    mockedRequest.mockResolvedValue({
      step: "WELCOME",
      interestsJson: null,
      completed: false,
    });

    await onboardingApi.get();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/onboarding");
  });

  it("writes PATCH /api/v1/me/onboarding with the given keys only", async () => {
    mockedRequest.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: null,
      completed: false,
    });

    await onboardingApi.update({ step: "INTERESTS" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/onboarding", {
      method: "PATCH",
      body: { step: "INTERESTS" },
    });
  });

  it("can persist interestsJson as a JSON string without touching completed", async () => {
    mockedRequest.mockResolvedValue({
      step: "PROFILE",
      interestsJson: '["前端开发"]',
      completed: false,
    });

    await onboardingApi.update({
      step: "PROFILE",
      interestsJson: JSON.stringify(["前端开发"]),
    });

    const [, options] = mockedRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).toEqual({
      step: "PROFILE",
      interestsJson: '["前端开发"]',
    });
    expect("completed" in options.body).toBe(false);
    expect(options.body.interestsJson).not.toBeNull();
  });
});
