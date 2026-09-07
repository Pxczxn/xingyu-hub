"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type StudioModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function StudioModal({ open, title, onClose, children, actions }: StudioModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="studio-modal-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 id="studio-modal-title" className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <div className="text-sm text-[#4b5870]">{children}</div>
        {actions ? <footer className="mt-6 flex justify-end gap-2">{actions}</footer> : null}
      </div>
    </div>
  );
}

export function PreviewModal(props: Omit<StudioModalProps, "title"> & { articleId?: string }) {
  const { articleId, ...rest } = props;
  return (
    <StudioModal {...rest} title="预览文章">
      <p>在编辑器中预览当前草稿。</p>
      {articleId ? <p className="mt-2"><Link href={`/articles/${articleId}`} className="text-accent hover:underline">打开公开预览页</Link></p> : null}
    </StudioModal>
  );
}

export function PublishModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="发布文章"><p>确认发布设置后提交。</p></StudioModal>;
}

export function SubmitModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="提交审核"><p>文章将进入审核流程。</p></StudioModal>;
}

export function ConflictModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="版本冲突"><p>检测到远程版本更新，请刷新后重试。</p></StudioModal>;
}

export function RecoveryModal(props: Omit<StudioModalProps, "title">) {
  return <StudioModal {...props} title="恢复草稿"><p>可从历史版本恢复内容。</p></StudioModal>;
}
