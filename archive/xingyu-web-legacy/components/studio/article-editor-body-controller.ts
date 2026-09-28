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

export type EditorLinkDraft = {
  text: string;
  url: string;
  hasSelection: boolean;
  isEditingLink: boolean;
  focusTarget: "text" | "url";
};

export type EditorLinkPayload = {
  text: string;
  url: string;
};

export type EditorCaretAnchor = {
  top: number;
  left: number;
  height: number;
};

export type ArticleEditorBodyController = {
  format: (action: EditorFormatAction) => void;
  uploadImage: (file: File) => void | Promise<void>;
  getMarkdown?: () => string;
  subscribeFormatState?: (listener: (state: EditorFormatState) => void) => () => void;
  readLinkDraft?: () => EditorLinkDraft | null;
  readCaretAnchor?: () => EditorCaretAnchor | null;
  focusEditor?: () => void;
  applyLink?: (payload: EditorLinkPayload) => void;
  removeLink?: () => void;
};
