/*
 * Series reader preferences (Phase 4B, 2026-10-19).
 *
 * The only persisted state is the reader's typography: font size and measure.
 * It is device-local, works for guests, and deliberately stores nothing about
 * WHAT was read — no article ids, chapter history, or progress. Progress stays
 * on the server and is governed by the user's reading-history setting.
 *
 * Storage contract:
 *   key   xingyu:series-reader:preferences:v1
 *   value {"fontSize":18,"layout":"medium"}
 *
 * Every read is validated field by field; malformed JSON, wrong types,
 * out-of-range sizes and unknown layout keys all fall back to the defaults.
 * Storage access itself is wrapped: localStorage can throw (private mode,
 * disabled storage), and a reading preference must never break the page.
 */

export const READER_PREFERENCES_KEY = "xingyu:series-reader:preferences:v1";

export const READER_LAYOUTS = [
  { key: "narrow", label: "窄", measure: "58ch" },
  { key: "medium", label: "适中", measure: "68ch" },
  { key: "wide", label: "宽", measure: "80ch" },
] as const;

export type ReaderLayout = (typeof READER_LAYOUTS)[number]["key"];

export type ReaderPreferences = {
  fontSize: number;
  layout: ReaderLayout;
};

export const READER_MIN_FONT_SIZE = 15;
export const READER_MAX_FONT_SIZE = 24;
export const READER_DEFAULT_PREFERENCES: ReaderPreferences = {
  fontSize: 18,
  layout: "medium",
};

/** The slice of Storage we need; injectable so the failure paths are testable. */
export type ReaderStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): ReaderStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isReaderLayout(value: unknown): value is ReaderLayout {
  return typeof value === "string" && READER_LAYOUTS.some((layout) => layout.key === value);
}

function isFontSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= READER_MIN_FONT_SIZE &&
    value <= READER_MAX_FONT_SIZE
  );
}

/**
 * Validates a parsed value. All-or-nothing on purpose: a half-valid record
 * (font size fine, layout unknown) is corrupt data, and mixing a stored field
 * with a default one would silently change the reader's chosen typography.
 */
export function normalizeReaderPreferences(value: unknown): ReaderPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...READER_DEFAULT_PREFERENCES };
  }
  const record = value as Record<string, unknown>;
  if (!isFontSize(record.fontSize) || !isReaderLayout(record.layout)) {
    return { ...READER_DEFAULT_PREFERENCES };
  }
  return { fontSize: record.fontSize, layout: record.layout };
}

export function loadReaderPreferences(
  storage: ReaderStorage | null = defaultStorage(),
): ReaderPreferences {
  if (!storage) return { ...READER_DEFAULT_PREFERENCES };
  try {
    const raw = storage.getItem(READER_PREFERENCES_KEY);
    if (!raw) return { ...READER_DEFAULT_PREFERENCES };
    return normalizeReaderPreferences(JSON.parse(raw));
  } catch {
    return { ...READER_DEFAULT_PREFERENCES };
  }
}

export function saveReaderPreferences(
  preferences: ReaderPreferences,
  storage: ReaderStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    // Only these two fields; the key is versioned, the payload stays minimal.
    storage.setItem(
      READER_PREFERENCES_KEY,
      JSON.stringify({ fontSize: preferences.fontSize, layout: preferences.layout }),
    );
  } catch {
    /* Storage unavailable or full: the in-memory setting still works. */
  }
}

export function clearReaderPreferences(storage: ReaderStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(READER_PREFERENCES_KEY);
  } catch {
    /* Ignore: nothing to recover. */
  }
}
