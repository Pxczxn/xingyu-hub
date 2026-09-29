import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import type { TopicSummary } from "@/api/topics/topics.types";
import type { ArticleVisibility } from "@/api/articles/articles.types";
import { VISIBILITY_OPTIONS } from "@/lib/article-editor-draft";

/*
 * Editor settings — Phase 1C-2, deliberately reduced from Legacy
 * components/studio/article-editor-settings.tsx.
 *
 * Legacy rendered five sections; only two are backed by a contract this round
 * can actually persist:
 *
 *   KEPT   话题        GET /api/v1/topics  +  PUT draft { topicIds }   (verified)
 *   KEPT   可见范围     PUT draft { visibility }  PUBLIC|UNLISTED|PRIVATE (verified)
 *
 *   DROPPED 封面图      upload goes to POST /api/v1/attachments — backend image
 *                      upload is forbidden this round, so there is no way to
 *                      produce a coverUrl. Hidden rather than shown as a control
 *                      that always fails. `coverUrl` is omitted from the save
 *                      payload, so an existing cover is preserved.
 *   DROPPED 个人分类    GET /api/v1/me/creation-space/categories works but the dev
 *                      space has 0 categories, and creating them belongs to an
 *                      unmigrated subsystem. `categoryId` is omitted from the
 *                      save payload, so an existing category is preserved.
 *   DROPPED 定时发布     scheduledPublishAt — scheduled publishing is forbidden.
 *   DROPPED 删除草稿     trash — deleting drafts is forbidden.
 *
 * The active pill uses the CSS-module `isActive` class. Legacy wrote the literal
 * string "is-active" against a `.isActive` rule, so its selected state never
 * actually styled — that is fixed here rather than copied.
 */

type ArticleEditorSettingsProps = {
  topics: TopicSummary[];
  topicIds: string[];
  visibility: ArticleVisibility;
  /** Phase 1C-3: IN_REVIEW drafts are not editable — the backend rejects saves. */
  readOnly?: boolean;
  onToggleTopic: (topicId: string) => void;
  onVisibilityChange: (value: ArticleVisibility) => void;
};

export function ArticleEditorSettings({
  topics,
  topicIds,
  visibility,
  readOnly = false,
  onToggleTopic,
  onVisibilityChange,
}: ArticleEditorSettingsProps) {
  return (
    <aside className={cn(styles.settings)} aria-label="发布设置">
      <section className={cn(styles.settingsCard)}>
        <h2>话题分类</h2>
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>话题</p>
          <div className={cn(styles.settingsPills)}>
            {topics.length ? (
              topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={topicIds.includes(topic.id)}
                  className={cn("cursor-pointer", topicIds.includes(topic.id) && styles.isActive)}
                  onClick={() => onToggleTopic(topic.id)}
                >
                  #{topic.name}
                </button>
              ))
            ) : (
              <span className={cn(styles.settingsHint)}>暂无可选话题</span>
            )}
          </div>
        </div>
      </section>

      <section className={cn(styles.settingsCard)}>
        <h2>发布选项</h2>
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>可见范围</p>
          <div className={cn(styles.settingsPills)}>
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={readOnly}
                aria-pressed={visibility === option.value}
                className={cn("cursor-pointer", visibility === option.value && styles.isActive)}
                onClick={() => onVisibilityChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
