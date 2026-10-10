/*
 * Auth domain types (extracted from the Legacy community API module — NOT the whole file).
 * Field names mirror the real backend contract; nothing invented.
 */

export type MeAccount = {
  email: string;
  emailVerified: boolean;
  mustChangePassword?: boolean;
  username?: string;
};

export type LoginPayload = {
  login: string;
  password: string;
  rememberMe?: boolean;
  uuid?: string;
  code?: string;
};

export type LoginResult = {
  token?: string;
  mustChangePassword?: boolean;
};

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  termsVersion: string;
  phone?: string;
  smsCode?: string;
  uuid?: string;
  code?: string;
};

export type RegisterResult = {
  userId: string;
  emailVerification: { status: string; canResend: boolean };
  mailPending?: boolean;
  auditStatus?: string | null;
};

export type CaptchaResult = { uuid: string; img: string };

export type PublicConfig = {
  registration: {
    enabled: boolean;
    verifyEmail: boolean;
    verifyPhone: boolean;
    needAudit: boolean;
    defaultRole: string;
    captchaEnabled: boolean;
  };
  password: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
  };
  storage: { maxSize: number; allowTypes: string };
  login: {
    rememberMe: boolean;
    captchaEnabled: boolean;
    captchaType: string;
    maxRetryCount: number;
  };
  sms: { enabled: boolean };
  siteName: string;
};

/** Subset of PublicConfig.password used by client-side password rules. */
export type PasswordPolicy = PublicConfig["password"];

/**
 * `POST /api/v1/auth/email/verify` 的真实返回。
 *
 * 后端按 token 的 `purpose` 严格分流（2026-10-08），因此 `status` 不再是自由字符串：
 *
 *   VERIFIED      —— REGISTER token 消费成功，只置了 email_verified_at
 *   EMAIL_CHANGED —— EMAIL_CHANGE token 消费成功，登录邮箱已换成 `email`
 *
 * 两者都必须如实区分：前者不需要重新登录，后者**会撤销全部会话**（含当前会话），
 * 于是用户点完换绑确认链接后手里的 token 已经失效，必须重新登录。
 * `email` 只在 EMAIL_CHANGED 时存在。
 */
export type VerifyEmailResult = {
  status: "VERIFIED" | "EMAIL_CHANGED" | string;
  email?: string;
};
export type ResendEmailResult = { acknowledged: boolean; mailPending: boolean };
export type PasswordRecoveryResult = {
  acknowledged: boolean;
  mailPending?: boolean;
  devResetLink?: string;
};
export type SmsRegisterResult = { acknowledged: boolean; smsPending?: boolean };
