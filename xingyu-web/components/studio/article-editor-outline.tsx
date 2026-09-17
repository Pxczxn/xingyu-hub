"use client";
import styles from "./studio-workspace.module.css";
import { cn } from "@/lib/utils";

import type { EditorOutlineItem } from "@/lib/article-markdown";

type ArticleEditorOutlineProps = {
  items: EditorOutlineItem[];
  activeIndex: number;
  onSelect: (item: EditorOutlineItem, index: number) => void;
};

export function ArticleEditorOutline({
  items,
  activeIndex,
  onSelect,
}: ArticleEditorOutlineProps) {
  return (
    <aside className={cn(styles.outline)} aria-label="文章大纲">
      <p className={cn(styles.outlineLabel)}>大纲</p>
      <nav className={cn(styles.outlineNav)}>
        {items.length ? (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles.outlineItem,
                index === activeIndex && styles.isActive,
                item.level === 2 && styles.isLevel2,
                item.level === 3 && styles.isLevel3,
                item.level === 4 && styles.isLevel4,
              )}
              onClick={() => onSelect(item, index)}
            >
              {item.text}
            </button>
          ))
        ) : (
          <p className={cn(styles.outlineEmpty)}>写几个标题，目录会自动出现</p>
        )}
      </nav>
    </aside>
  );
}
