import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";

export type EditorFormatAction =
  | "bold"
  | "italic"
  | "strike"
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "quote"
  | "codeBlock"
  | "hr"
  | "taskList"
  | "clearInlineFormat"
  | "link"
  | "code"
  | "ul"
  | "ol"
  | "image"
  | "undo"
  | "redo";

export type ArticleEditorBodyController = {
  format: (action: EditorFormatAction) => void;
  uploadImage: (file: File) => void | Promise<void>;
  getMarkdown?: () => string;
  subscribeFormatState?: (listener: (state: EditorFormatState) => void) => () => void;
};
