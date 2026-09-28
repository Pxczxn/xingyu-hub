import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { Button } from "@/components/ui/button";

/*
 * Submit-for-review confirmation (Phase 1C-3).
 *
 * Submitting is effectively irreversible from the creator side: the backend
 * flips the article to IN_REVIEW and `canEditDraft` then rejects every further
 * save with 409 "文章当前不可编辑" (verified against the live backend). A confirm
 * step is therefore required — but kept deliberately plain, per the phase brief:
 * no multi-step wizard, no extra options.
 */

type EditorSubmitConfirmProps = {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EditorSubmitConfirm({
  open,
  busy = false,
  onCancel,
  onConfirm,
}: EditorSubmitConfirmProps) {
  if (!open) return null;

  return (
    <div
      className={cn(styles.submitConfirm)}
      role="alertdialog"
      aria-modal="true"
      aria-label="确认提交审核"
    >
      <div className={cn(styles.submitConfirmCard)}>
        <h2>确认提交审核？</h2>
        <p>提交后文章进入审核流程，审核期间不可再编辑。</p>
        <div className={cn(styles.submitConfirmActions)}>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "提交中…" : "确认提交"}
          </Button>
        </div>
      </div>
    </div>
  );
}
