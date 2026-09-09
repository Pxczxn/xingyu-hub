"use client";

import Image from "next/image";
import { Calendar, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreationCategory, TopicSummary } from "@/lib/community-api";

type ArticleEditorSettingsProps = {
  categories: CreationCategory[];
  topics: TopicSummary[];
  categoryId: string | null;
  topicIds: string[];
  visibility: string;
  scheduledPublishAt: string;
  onCategoryChange: (id: string | null) => void;
  onToggleTopic: (topicId: string) => void;
  onVisibilityChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
  onTrash: () => void;
};

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "公开" },
  { value: "UNLISTED", label: "不收录" },
  { value: "PRIVATE", label: "私密" },
] as const;

export function ArticleEditorSettings({
  categories,
  topics,
  categoryId,
  topicIds,
  visibility,
  scheduledPublishAt,
  onCategoryChange,
  onToggleTopic,
  onVisibilityChange,
  onScheduleChange,
  onTrash,
}: ArticleEditorSettingsProps) {
  return (
    <aside className="xy-editor-settings" aria-label="发布设置">
      <section className="xy-editor-settings__card">
        <h2>封面图</h2>
        <div className="xy-editor-settings__cover">
          <div className="xy-editor-settings__cover-preview">
            <Image
              src="/prototype-assets/article-editor/cover-preview.png"
              alt="封面预览"
              width={240}
              height={135}
            />
          </div>
          <p className="xy-editor-settings__hint">上传接口还在接入中，暂时无法更换</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="cursor-not-allowed"
          >
            <ImageIcon className="h-4 w-4" />
            更换封面
          </Button>
        </div>
      </section>

      <section className="xy-editor-settings__card">
        <h2>话题分类</h2>
        {categories.length ? (
          <div className="xy-editor-settings__group">
            <p className="xy-editor-settings__subhead">个人分类</p>
            <div className="xy-editor-settings__pills">
              <button
                type="button"
                className={!categoryId ? "is-active" : ""}
                onClick={() => onCategoryChange(null)}
              >
                未分类
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={categoryId === category.id ? "is-active" : ""}
                  onClick={() => onCategoryChange(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="xy-editor-settings__group">
          <p className="xy-editor-settings__subhead">话题</p>
          <div className="xy-editor-settings__pills">
            {topics.length ? (
              topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={topicIds.includes(topic.id) ? "is-active" : ""}
                  onClick={() => onToggleTopic(topic.id)}
                >
                  #{topic.name}
                </button>
              ))
            ) : (
              <span className="xy-editor-settings__hint">暂无可选话题</span>
            )}
          </div>
        </div>
      </section>

      <section className="xy-editor-settings__card">
        <h2>发布选项</h2>
        <div className="xy-editor-settings__group">
          <p className="xy-editor-settings__subhead">可见范围</p>
          <div className="xy-editor-settings__pills">
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={visibility === option.value ? "is-active" : ""}
                onClick={() => onVisibilityChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="xy-editor-settings__group">
          <p className="xy-editor-settings__subhead">
            <Calendar className="h-3.5 w-3.5" />
            定时发布
          </p>
          <input
            type="datetime-local"
            className="xy-editor-settings__datetime"
            value={scheduledPublishAt}
            onChange={(e) => onScheduleChange(e.target.value)}
          />
        </div>
      </section>

      <section className="xy-editor-settings__card xy-editor-settings__card--danger">
        <h2>删除草稿</h2>
        <p className="xy-editor-settings__hint">移入回收站后仍可在内容列表找回。</p>
        <Button
          type="button"
          variant="outline"
          className="xy-editor-settings__trash"
          onClick={onTrash}
        >
          <Trash2 className="h-4 w-4" />
          删除草稿
        </Button>
      </section>
    </aside>
  );
}
