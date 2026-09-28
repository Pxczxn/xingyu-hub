"use client";
import styles from "./studio-workspace.module.css";
import { cn } from "@/lib/utils";

import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

import type { EditorFormatAction } from "@/components/studio/article-editor-body-controller";

export type { EditorFormatAction };

type ArticleEditorFormatBarProps = {
  onAction: (action: EditorFormatAction) => void;
  onImageSelect?: (file: File) => void;
  disabled?: boolean;
};

const ACTIONS: { action: EditorFormatAction; title: string; icon: typeof Bold }[] = [
  { action: "bold", title: "加粗", icon: Bold },
  { action: "italic", title: "斜体", icon: Italic },
  { action: "h1", title: "一级标题", icon: Heading1 },
  { action: "h2", title: "二级标题", icon: Heading2 },
  { action: "h3", title: "三级标题", icon: Heading3 },
  { action: "link", title: "链接", icon: Link2 },
  { action: "quote", title: "引用", icon: Quote },
  { action: "code", title: "行内代码", icon: Code },
  { action: "ul", title: "无序列表", icon: List },
  { action: "ol", title: "有序列表", icon: ListOrdered },
];

export function ArticleEditorFormatBar({
  onAction,
  onImageSelect,
  disabled = false,
}: ArticleEditorFormatBarProps) {
  return (
    <div className={cn(styles.formatBar)} role="toolbar" aria-label="正文格式">
      {ACTIONS.map(({ action, title, icon: Icon }) => (
        <button
          key={action}
          type="button"
          title={title}
          disabled={disabled}
          className="cursor-pointer"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction(action)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      {onImageSelect ? (
        <label className={cn(styles.formatBarUpload, "cursor-pointer")} title="插入图片">
          <ImagePlus className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImageSelect(file);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
