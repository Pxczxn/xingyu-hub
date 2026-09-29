/*
 * Account security logic (Phase 3H) — pure, no React.
 *
 * Everything here exists to keep the UI HONEST about what these endpoints do,
 * because two of them are easy to misrepresent:
 *
 *  1. **Email change does not change the email.** It sends a confirmation link to
 *     the new address. `mailPending: false` means that mail FAILED to send, so
 *     the change will never complete — that is a failure, not a success.
 *
 *  2. **Account "deletion" does not delete.** `requestAccountDeletion` sets
 *     status to SUSPENDED and returns 204. There is no erasure job and no
 *     cancel endpoint in the backend. So the copy says "停用" and warns that the
 *     UI offers no way back, rather than promising irreversible deletion.
 */

/** Mirrors the backend `EMAIL_PATTERN` intent without pretending to be RFC-complete. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export type FieldCheck = { ok: true } | { ok: false; message: string };

export function checkNewEmail(
  newEmail: string,
  currentEmail: string | null | undefined,
): FieldCheck {
  const value = newEmail.trim();
  if (!value) return { ok: false, message: "请输入新邮箱。" };
  if (!EMAIL_SHAPE.test(value)) return { ok: false, message: "邮箱格式不正确。" };
  // The backend rejects this with 400 「新邮箱不能与当前邮箱相同」; catching it
  // locally avoids a pointless round trip.
  if (currentEmail && value.toLowerCase() === currentEmail.trim().toLowerCase()) {
    return { ok: false, message: "新邮箱不能与当前邮箱相同。" };
  }
  return { ok: true };
}

export function checkPasswordForReauth(password: string): FieldCheck {
  if (!password) return { ok: false, message: "请输入当前密码。" };
  return { ok: true };
}

/**
 * Message shown after a successful `changeEmail` call.
 *
 * The two branches are NOT "success/failure" of the request — both are HTTP 200.
 * They differ in whether the confirmation mail actually went out, and the user
 * acts differently in each case, so they must read differently.
 */
export function emailChangeNotice(result: {
  currentEmail: string;
  pendingEmail: string;
  mailPending: boolean;
}): { tone: "success" | "warning"; message: string } {
  if (!result.mailPending) {
    return {
      tone: "warning",
      message: `确认邮件暂未成功投递，${result.currentEmail} 仍然有效。请稍后重试或联系管理员。`,
    };
  }
  return {
    tone: "success",
    message: `确认邮件已发送至 ${result.pendingEmail}。完成确认后新邮箱才会生效，当前邮箱 ${result.currentEmail} 在此之前仍然有效。`,
  };
}

/** Human label for how long a re-auth grant lasts. */
export function recentAuthNotice(): string {
  return "为保护账号，修改邮箱前需要先用当前密码验证身份，验证结果 15 分钟内有效。";
}

/**
 * Copy for the account-deletion request. Deliberately says 停用 (deactivate),
 * not 删除 (delete) — see the module header. `disabled` is the backend's own
 * vocabulary (`user.setStatus("SUSPENDED")`).
 */
export const ACCOUNT_DEACTIVATION_WARNING =
  "此操作会立即停用你的账号，你将无法继续登录。当前版本没有提供自助恢复入口，如需重新启用请联系管理员。";

export const ACCOUNT_DEACTIVATION_CONFIRM_LABEL = "确认停用账号";

/** Filename for the client-side JSON download. */
export function dataExportFilename(now: Date): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `xingyu-data-export-${stamp}.json`;
}

/**
 * Top-level section names present in the export, for a human preview.
 *
 * `DataExportService` builds a LinkedHashMap in this fixed order, so the preview
 * is deterministic. Anything unexpected is listed too (we never hide keys the
 * server chose to add), with a safe label fallback.
 */
const EXPORT_SECTION_LABELS: Record<string, string> = {
  exportedAt: "导出时间",
  profile: "个人资料",
  articles: "我的文章",
  collections: "我的收藏夹",
  comments: "我的评论",
  likes: "我的点赞",
  bookshelf: "我的书架",
  readingHistory: "阅读历史",
};

export function exportSections(payload: Record<string, unknown>): Array<{
  key: string;
  label: string;
  count: number | null;
}> {
  return Object.entries(payload).map(([key, value]) => ({
    key,
    label: EXPORT_SECTION_LABELS[key] ?? key,
    count: Array.isArray(value) ? value.length : null,
  }));
}
