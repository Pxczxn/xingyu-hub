export const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

export const USERNAME_FORMAT_HINT = "小写字母、数字、下划线，3-32 位";

export const USERNAME_FORMAT_RULES = [
  { id: "lowercase", label: "小写字母" },
  { id: "number", label: "数字" },
  { id: "underscore", label: "下划线" },
] as const;

export const USERNAME_UNAVAILABLE_MESSAGE = "用户名不可用";

export function validateUsernameClient(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    return USERNAME_UNAVAILABLE_MESSAGE;
  }
  return null;
}

export function mapUsernameFieldError(_message: string): string {
  return USERNAME_UNAVAILABLE_MESSAGE;
}
