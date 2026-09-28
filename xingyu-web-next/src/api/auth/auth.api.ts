/*
 * Auth domain API (extracted from the Legacy community API module — NOT the whole file).
 * All endpoints keep the real /api/v1/* contract; the satoken header behaviour is
 * unchanged and handled by api/client.ts.
 */
import { apiRequest } from "@/api/client";
import type {
  CaptchaResult,
  LoginPayload,
  LoginResult,
  MeAccount,
  PasswordRecoveryResult,
  PublicConfig,
  RegisterPayload,
  RegisterResult,
  ResendEmailResult,
  SmsRegisterResult,
  VerifyEmailResult,
} from "./auth.types";

export const authApi = {
  getPublicConfig: (): Promise<PublicConfig> => apiRequest<PublicConfig>("/api/v1/public/config"),

  getCaptcha: (): Promise<CaptchaResult> => apiRequest<CaptchaResult>("/api/v1/auth/captcha"),

  login: (payload: LoginPayload): Promise<LoginResult> =>
    apiRequest<LoginResult>("/api/v1/auth/login", { method: "POST", body: payload }),

  register: (payload: RegisterPayload, idempotencyKey?: string): Promise<RegisterResult> =>
    apiRequest<RegisterResult>("/api/v1/auth/register", {
      method: "POST",
      body: payload,
      idempotencyKey,
    }),

  logout: (): Promise<void> => apiRequest<void>("/api/v1/auth/logout", { method: "POST" }),

  getMe: (): Promise<MeAccount> => apiRequest<MeAccount>("/api/v1/me"),

  verifyEmail: (token: string): Promise<VerifyEmailResult> =>
    apiRequest<VerifyEmailResult>("/api/v1/auth/email/verify", {
      method: "POST",
      body: { token },
    }),

  resendEmailVerification: (email?: string): Promise<ResendEmailResult> =>
    apiRequest<ResendEmailResult>("/api/v1/auth/email/resend", {
      method: "POST",
      body: email ? { email } : undefined,
    }),

  requestPasswordRecovery: (login: string): Promise<PasswordRecoveryResult> =>
    apiRequest<PasswordRecoveryResult>("/api/v1/auth/password-recovery", {
      method: "POST",
      body: { login },
    }),

  resetPassword: (payload: { token: string; password: string }): Promise<void> =>
    apiRequest<void>("/api/v1/auth/password-reset", { method: "POST", body: payload }),

  forceChangePassword: (newPassword: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/password/force-change", {
      method: "POST",
      body: { newPassword },
    }),

  sendRegisterSms: (phone: string): Promise<SmsRegisterResult> =>
    apiRequest<SmsRegisterResult>("/api/v1/auth/sms/register", {
      method: "POST",
      body: { phone },
    }),
};
