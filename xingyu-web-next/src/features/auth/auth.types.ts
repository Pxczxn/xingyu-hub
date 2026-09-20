/** Feature-level auth types for Web V2 (Phase 0). */

export type LoginFormValues = {
  login: string;
  password: string;
  rememberMe: boolean;
};

/** Location state set by the auth guard so login can return the user to where they came from. */
export type LoginLocationState = {
  from?: string;
};
