import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";
import type { EditorOutlineItem } from "@/lib/article-editor-outline";

/*
 * Migrated from Legacy components/studio/article-editor-outline.tsx.
 * Adaptation: CSS module import + cn path only. Markup and class usage are 1:1.
 * The outline item type now comes from the editor core (lib/article-editor-outline)
 * instead of the reading module.
 */

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
