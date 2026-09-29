/*
 * Onboarding domain API (Phase 2A-3).
 *
 * VERIFIED against the live backend 2026-09-24 (isolated test DB):
 *   GET    /api/v1/me/onboarding  -> OnboardingState (200; synthesised WELCOME
 *                                   when the row is missing)
 *   PATCH  /api/v1/me/onboarding  -> OnboardingState (200, partial merge)
 *
 * These are the ONLY wrappers for this pair. Do not add a second module.
 */
import { apiRequest } from "@/api/client";
import type { OnboardingPatch, OnboardingState } from "./onboarding.types";

export const onboardingApi = {
  get: (): Promise<OnboardingState> => apiRequest<OnboardingState>("/api/v1/me/onboarding"),

  update: (payload: OnboardingPatch): Promise<OnboardingState> =>
    apiRequest<OnboardingState>("/api/v1/me/onboarding", {
      method: "PATCH",
      body: payload,
    }),
};
