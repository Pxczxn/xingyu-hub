export type EditorCaretAnchor = {
  top: number;
  left: number;
  height: number;
};

const MIRROR_PROPERTIES = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

/** Returns viewport coordinates for the textarea caret. */
export function getTextareaCaretAnchor(textarea: HTMLTextAreaElement): EditorCaretAnchor {
  const position = textarea.selectionEnd;
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  document.body.appendChild(mirror);

  const mirrorStyle = mirror.style;
  mirrorStyle.position = "absolute";
  mirrorStyle.visibility = "hidden";
  mirrorStyle.whiteSpace = "pre-wrap";
  mirrorStyle.wordWrap = "break-word";
  mirrorStyle.overflow = "hidden";

  MIRROR_PROPERTIES.forEach((property) => {
    mirrorStyle.setProperty(property, computed.getPropertyValue(property));
  });

  mirrorStyle.width = `${textarea.offsetWidth}px`;

  const textBefore = textarea.value.substring(0, position);
  mirror.textContent = textBefore;

  const marker = document.createElement("span");
  marker.textContent = textarea.value.substring(position) || ".";
  mirror.appendChild(marker);

  const textareaRect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.85;

  return {
    top: textareaRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop,
    left: textareaRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft,
    height: markerRect.height || lineHeight,
  };
}

export function clampLinkPopoverPosition(
  anchor: EditorCaretAnchor,
  size: { width: number; height: number },
): { top: number; left: number } {
  const margin = 8;
  const gap = 6;
  let top = anchor.top + anchor.height + gap;
  let left = anchor.left;

  if (left + size.width > window.innerWidth - margin) {
    left = window.innerWidth - size.width - margin;
  }
  if (left < margin) left = margin;

  if (top + size.height > window.innerHeight - margin) {
    top = anchor.top - size.height - gap;
  }
  if (top < margin) top = margin;

  return { top, left };
}
