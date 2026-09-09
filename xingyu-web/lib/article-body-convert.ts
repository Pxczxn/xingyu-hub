export type ArticleBodyMode = "MARKDOWN" | "RICH_TEXT";

export function normalizeBodyMode(mode: string | null | undefined): ArticleBodyMode {
  return mode === "RICH_TEXT" ? "RICH_TEXT" : "MARKDOWN";
}

/** 编辑器模式仅依据后端保存的 bodyMode，正文始终按 Markdown 持久化。 */
export function inferBodyMode(_body: string, savedMode?: string | null): ArticleBodyMode {
  return normalizeBodyMode(savedMode);
}
