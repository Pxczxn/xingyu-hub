export type MarkdownEditorSnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const MAX_HISTORY_DEPTH = 100;

/**
 * Tracks undo/redo for programmatic Markdown edits (toolbar, image insert).
 * Typing still uses the browser's native Ctrl+Z history — this stack is not
 * merged with native undo to avoid breaking textarea input history.
 */
export class MarkdownFormatHistory {
  private undoStack: MarkdownEditorSnapshot[] = [];
  private redoStack: MarkdownEditorSnapshot[] = [];

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  recordBefore(snapshot: MarkdownEditorSnapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_HISTORY_DEPTH) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(current: MarkdownEditorSnapshot): MarkdownEditorSnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(current);
    return previous;
  }

  redo(current: MarkdownEditorSnapshot): MarkdownEditorSnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(current);
    return next;
  }
}
