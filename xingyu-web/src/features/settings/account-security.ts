/*
 * Account security logic — pure, no React.
 *
 * Everything here exists to keep the UI HONEST about what these endpoints do,
 * because two of them are easy to misrepresent:
 *
 *  1. **Requesting an email change does not change the email.** It sends a
 *     confirmation link to the new address, and only following that link
 *     activates it. `mailPending: true` means that mail FAILED to send, so the
 *     user will not receive the link — that is a failure, not a success.
 *
 *  2. **Account "deletion" does not delete.** `requestAccountDeletion` sets
 *     status to SUSPENDED and returns 204. Nothing is erased or anonymised, and
 *     there is no cancel endpoint in the backend. So the copy says "停用" and
 *     warns that the UI offers no way back, rather than promising deletion.
 *
 * --- 2026-10-08 (Settings Contract Recovery) ---------------------------------
 * Both of the above used to be half-true, and both were fixed on the server:
 *
 *  - Email change now COMPLETES. `verifyEmail` dispatches on the token's
 *    purpose and an EMAIL_CHANGE token really does rebind `user.email`.
 *  - Deactivation now demands a fresh, single-use re-auth grant, so it is no
 *    longer something any logged-in session can trigger by accident.
 *
 * What did NOT change: deactivation still only suspends. The copy below must
 * keep saying 停用.
 */

/** Mirrors the backend `EMAIL_PATTERN` intent without pretending to be RFC-complete. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 *
 * Backend contract (CommunityAccountService.sendVerificationMail): the send is
 * wrapped in try/catch, so `mailPending: true` ⇔ the mail did NOT go out, and
 * `false` ⇔ it was sent. (2026-10-09: both branches used to be keyed on the
 * INVERTED reading of this flag, and the unit tests were written to match —
 * so the UI told users a failed delivery had been "sent" while staying green.)
 *
 * The success branch now also has to warn that confirming will sign the user
 * out everywhere: the backend revokes every session on a successful rebind, so
 * the confirmation link is a one-way door. Saying so up front is the difference
 * between "my account broke" and "I was told this would happen".
 */
export function emailChangeNotice(result: {
  currentEmail: string;
  pendingEmail: string;
  mailPending: boolean;
}): { tone: "success" | "warning"; message: string } {
  if (result.mailPending) {
    // mailPending=true ⇔ the mail did NOT go out (see the contract note above).
    // Claiming 已发送 here would violate "未发出不得宣称已发送或已送达".
    return {
      tone: "warning",
      message: `确认邮件暂未成功投递，${result.currentEmail} 仍然有效。请稍后重试或联系管理员。`,
    };
  }
  return {
    tone: "success",
    message: `确认邮件已发送至 ${result.pendingEmail}。完成确认后新邮箱才会生效，当前邮箱 ${result.currentEmail} 在此之前仍然有效；确认后需要重新登录。`,
  };
}

/** Human label for how long a re-auth grant lasts. */
export function recentAuthNotice(): string {
  return "为保护账号，修改邮箱或停用账号前需要先用当前密码验证身份，验证结果 15 分钟内有效。";
}

/**
 * Copy for the account-deletion request. Deliberately says 停用 (deactivate),
 * not 删除 (delete) — see the module header. `SUSPENDED` is the backend's own
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
