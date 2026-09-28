export type ArticleMediaItem = {
  id: string;
  url: string;
  alt?: string;
};

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_IMAGE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const PLAIN_IMAGE_URL =
  /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s<>"']*)?/gi;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }
  return trimmed;
}

export function extractArticleMedia(body: string): ArticleMediaItem[] {
  const items: ArticleMediaItem[] = [];
  const seen = new Set<string>();

  function push(url: string, alt?: string) {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    items.push({ id: String(items.length), url: normalized, alt });
  }

  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    push(match[2], match[1] || undefined);
  }

  for (const match of body.matchAll(HTML_IMAGE)) {
    push(match[1]);
  }

  for (const match of body.matchAll(PLAIN_IMAGE_URL)) {
    push(match[0]);
  }

  return items;
}

export function findArticleMedia(body: string, mediaId: string): ArticleMediaItem | null {
  const items = extractArticleMedia(body);
  const index = Number.parseInt(mediaId, 10);
  if (!Number.isNaN(index) && index >= 0 && index < items.length) {
    return items[index];
  }
  return items.find((item) => item.id === mediaId) ?? null;
}
