import { describe, expect, it } from "vitest";
import {
  READER_DEFAULT_PREFERENCES,
  READER_PREFERENCES_KEY,
  type ReaderStorage,
  clearReaderPreferences,
  loadReaderPreferences,
  normalizeReaderPreferences,
  saveReaderPreferences,
} from "./reader-preferences";

function storageWith(raw: string | null): ReaderStorage {
  return {
    getItem: () => raw,
    setItem: () => {},
    removeItem: () => {},
  };
}

function throwingStorage(): ReaderStorage {
  return {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("storage disabled");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
  };
}

describe("reader preferences", () => {
  it("uses a versioned, reader-specific key", () => {
    expect(READER_PREFERENCES_KEY).toBe("xingyu:series-reader:preferences:v1");
  });

  it("falls back to 18px / medium when nothing is stored", () => {
    expect(loadReaderPreferences(storageWith(null))).toEqual(READER_DEFAULT_PREFERENCES);
    expect(READER_DEFAULT_PREFERENCES).toEqual({ fontSize: 18, layout: "medium" });
  });

  it("restores a valid stored choice", () => {
    expect(
      loadReaderPreferences(storageWith(JSON.stringify({ fontSize: 22, layout: "wide" }))),
    ).toEqual({ fontSize: 22, layout: "wide" });
  });

  it("falls back on malformed JSON instead of throwing", () => {
    expect(loadReaderPreferences(storageWith("{not json"))).toEqual(READER_DEFAULT_PREFERENCES);
  });

  it.each([
    ["out-of-range font size", { fontSize: 30, layout: "medium" }],
    ["below the floor", { fontSize: 10, layout: "medium" }],
    ["non-integer font size", { fontSize: 18.5, layout: "medium" }],
    ["string font size", { fontSize: "20", layout: "medium" }],
    ["unknown layout", { fontSize: 18, layout: "huge" }],
    ["missing layout", { fontSize: 18 }],
    ["array payload", [18, "medium"]],
    ["null payload", null],
  ])("rejects %s and falls back to defaults", (_name, payload) => {
    expect(loadReaderPreferences(storageWith(JSON.stringify(payload)))).toEqual(
      READER_DEFAULT_PREFERENCES,
    );
    expect(normalizeReaderPreferences(payload)).toEqual(READER_DEFAULT_PREFERENCES);
  });

  it("writes only the two typography fields under the namespaced key", () => {
    const writes: Array<[string, string]> = [];
    const storage: ReaderStorage = {
      getItem: () => null,
      setItem: (key, value) => writes.push([key, value]),
      removeItem: () => {},
    };

    saveReaderPreferences({ fontSize: 21, layout: "narrow" }, storage);

    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe(READER_PREFERENCES_KEY);
    expect(JSON.parse(writes[0][1])).toEqual({ fontSize: 21, layout: "narrow" });
  });

  it("never throws when storage access itself fails", () => {
    const storage = throwingStorage();
    expect(loadReaderPreferences(storage)).toEqual(READER_DEFAULT_PREFERENCES);
    expect(() => saveReaderPreferences(READER_DEFAULT_PREFERENCES, storage)).not.toThrow();
    expect(() => clearReaderPreferences(storage)).not.toThrow();
  });

  it("clears the stored key", () => {
    const removed: string[] = [];
    const storage: ReaderStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: (key) => removed.push(key),
    };

    clearReaderPreferences(storage);

    expect(removed).toEqual([READER_PREFERENCES_KEY]);
  });
});
