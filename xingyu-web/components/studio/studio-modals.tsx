"use client";

import styles from "./studio-workspace.module.css";
import { Button } from "@/components/ui/button";
import { ArticleMarkdownBody } from "@/lib/article-markdown";
import { cn } from "@/lib/utils";

type StudioModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: "md" | "preview";
};

export function StudioModal({
  open,
  title,
  onClose,
  children,
  actions,
  size = "md",
}: StudioModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-modal-title"
    >
      <div
        className={cn(
          "w-full rounded-2xl bg-white p-6 shadow-xl",
          size === "preview" ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 id="studio-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </header>
        <div className={cn("text-sm text-[#4b5870]", size === "preview" && "text-base")}>
          {children}
        </div>
        {actions ? <footer className="mt-6 flex justify-end gap-2">{actions}</footer> : null}
      </div>
    </div>
  );
}

type PreviewModalProps = Omit<StudioModalProps, "title" | "children" | "size"> & {
  articleTitle: string;
  summary: string;
  body: string;
};

export function PreviewModal({
  open,
  onClose,
  articleTitle,
  summary,
  body,
}: PreviewModalProps) {
  return (
    <StudioModal open={open} onClose={onClose} title="预览文章" size="preview">
      <div>
        <header className={cn(styles.previewHeader)}>
          <h3 className={cn(styles.previewTitle)}>{articleTitle.trim() || "无标题"}</h3>
          {summary.trim() ? <p className={cn(styles.previewSummary)}>{summary}</p> : null}
        </header>
        <div className={cn(styles.previewBody, "xy-article-body")}>
          <ArticleMarkdownBody body={body} />
        </div>
      </div>
    </StudioModal>
  );
}

export function PublishModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="发布文章"><p>确认发布设置后提交。</p></StudioModal>;
}

type SubmitModalProps = Omit<StudioModalProps, "title" | "children" | "actions"> & {
  articleTitle: string;
  visibilityLabel: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
};

export function SubmitModal({
  open,
  onClose,
  articleTitle,
  visibilityLabel,
  submitting = false,
  error,
  onConfirm,
}: SubmitModalProps) {
  return (
    <StudioModal
      open={open}
      onClose={onClose}
      title="提交审核"
      actions={
        <>
          <Button variant="outline" type="button" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button type="button" disabled={submitting} onClick={onConfirm}>
            {submitting ? "提交中…" : "确认提交"}
          </Button>
        </>
      }
    >
      <p>提交后会将当前草稿冻结为正式修订版本，并进入平台审核流程。</p>
      <p className="mt-2">若文章已发布，审核通过前将继续对外展示上一个已发布版本。</p>
      <dl className="mt-4 grid gap-2 rounded-xl border border-[#e7ebf3] bg-[#f8fafc] p-3 text-sm">
        <div className="grid grid-cols-[4.5rem_1fr] gap-2">
          <dt className="text-[#7c8798]">标题</dt>
          <dd className="font-medium text-[#1e293b]">{articleTitle || "无标题"}</dd>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] gap-2">
          <dt className="text-[#7c8798]">可见范围</dt>
          <dd className="font-medium text-[#1e293b]">{visibilityLabel}</dd>
        </div>
      </dl>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </StudioModal>
  );
}

export function ConflictModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="版本冲突"><p>检测到远程版本更新，请刷新后重试。</p></StudioModal>;
}

export function RecoveryModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="恢复草稿"><p>可从历史版本恢复内容。</p></StudioModal>;
}
