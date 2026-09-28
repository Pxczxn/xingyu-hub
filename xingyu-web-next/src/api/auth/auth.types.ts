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
  login: { rememberMe: boolean; captchaEnabled: boolean; captchaType: string; maxRetryCount: number };
  sms: { enabled: boolean };
  siteName: string;
};

/** Subset of PublicConfig.password used by client-side password rules. */
export type PasswordPolicy = PublicConfig["password"];

export type VerifyEmailResult = { status: string };
export type ResendEmailResult = { acknowledged: boolean; mailPending: boolean };
export type PasswordRecoveryResult = {
  acknowledged: boolean;
  mailPending?: boolean;
  devResetLink?: string;
};
export type SmsRegisterResult = { acknowledged: boolean; smsPending?: boolean };
