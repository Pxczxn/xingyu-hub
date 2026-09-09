"use client";

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
    <aside className="xy-editor-outline" aria-label="文章大纲">
      <p className="xy-editor-outline__label">大纲</p>
      <nav className="xy-editor-outline__nav">
        {items.length ? (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={[
                "xy-editor-outline__item",
                index === activeIndex ? "is-active" : "",
                item.level === 2 ? "is-level-2" : "",
                item.level === 3 ? "is-level-3" : "",
                item.level === 4 ? "is-level-4" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(item, index)}
            >
              {item.text}
            </button>
          ))
        ) : (
          <p className="xy-editor-outline__empty">写几个标题，目录会自动出现</p>
        )}
      </nav>
    </aside>
  );
}
