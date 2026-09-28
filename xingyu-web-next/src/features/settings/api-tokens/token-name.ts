import { API_TOKEN_NAME_MAX_LENGTH } from "@/api/settings/api-tokens.types";

/*
 * Token-name validation (Phase 2A-2b).
 *
 * Lives in its own module so the same rule runs in two places:
 *   1. the form (to disable the button / show a hint), and
 *   2. the submit handler (per SKILL §7d — `disabled` is not an invariant).
 *
 * The max length is NOT cosmetic: the backend column is `varchar(128)` and the
 * service never checks length, so a longer name surfaces as a generic
 * 500 INTERNAL_ERROR. Capping client-side keeps that from ever being reachable.
 */
export function validateApiTokenName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "请填写 Token 名称。";
  if (trimmed.length > API_TOKEN_NAME_MAX_LENGTH) {
    return `名称不能超过 ${API_TOKEN_NAME_MAX_LENGTH} 个字符。`;
  }
  return null;
}
