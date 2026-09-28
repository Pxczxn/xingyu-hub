/** Returns true when the text looks like a URL or site path suitable as link href. */
export function isLikelyUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("./")) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (/^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(trimmed)) return true;
  return false;
}

/**
 * Normalizes user-entered link targets.
 * Adds https:// for bare domains while preserving relative paths like /articles/...
 */
export function normalizeLinkUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("./")) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isLinkUrlEmpty(input: string): boolean {
  return normalizeLinkUrl(input).length === 0;
}
