/*
 * Onboarding contract — verified live 2026-09-24 against the isolated test DB.
 *
 *   GET   /api/v1/me/onboarding  -> OnboardingState (200)
 *   PATCH /api/v1/me/onboarding  -> OnboardingState (200), partial merge
 *
 * Shape is exactly three keys. Missing row on GET synthesises:
 *   { step: "WELCOME", interestsJson: null, completed: false }
 *
 * PATCH is `body.containsKey` merge. `{}` is a no-op.
 * `interestsJson: null` is NOT a clear: the PATCH response may echo null while
 * GET still returns the previous string (MyBatis-Plus NOT_NULL). Callers must
 * never treat a null echo as persistence, and the UI never sends null.
 */

export const ONBOARDING_STEPS = ["WELCOME", "INTERESTS", "FOLLOWS", "PROFILE", "DONE"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  step: string;
  interestsJson: string | null;
  completed: boolean;
};

export type OnboardingPatch = {
  step?: string;
  interestsJson?: string;
  completed?: boolean;
};
