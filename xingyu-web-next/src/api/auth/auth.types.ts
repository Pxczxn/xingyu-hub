/*
 * Auth domain types (extracted from the Legacy community API module — NOT the whole file).
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

/** Subset of Legacy PublicConfig.password used by client-side password rules. */
export type PasswordPolicy = {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};
