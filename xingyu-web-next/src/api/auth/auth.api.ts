/*
 * Auth domain API (extracted from the Legacy community API module).
 * Only login / getMe / logout are migrated for Phase 0. The /api/v1/* contract
 * and the satoken header behavior are unchanged (handled by api/client.ts).
 */
import { apiRequest } from "@/api/client";
import type { LoginPayload, LoginResult, MeAccount } from "./auth.types";

export const authApi = {
  login: (payload: LoginPayload): Promise<LoginResult> =>
    apiRequest<LoginResult>("/api/v1/auth/login", {
      method: "POST",
      body: payload,
    }),

  getMe: (): Promise<MeAccount> => apiRequest<MeAccount>("/api/v1/me"),

  logout: (): Promise<void> =>
    apiRequest<void>("/api/v1/auth/logout", { method: "POST" }),
};
