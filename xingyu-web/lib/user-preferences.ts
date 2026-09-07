import { communityApi } from "@/lib/community-api";

const NOTIFICATION_KEY = "xingyu.notificationPrefs";
const PREFERENCES_KEY = "xingyu.preferences";
const SEARCH_HISTORY_KEY = "xingyu.searchHistory";

export type NotificationPrefs = {
  mentions: boolean;
  comments: boolean;
  follows: boolean;
  system: boolean;
};

export type UserPreferences = {
  compactMode: boolean;
  reduceMotion: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  mentions: true,
  comments: true,
  follows: true,
  system: true,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  compactMode: false,
  reduceMotion: false,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getNotificationPrefs(): NotificationPrefs {
  return readJson(NOTIFICATION_KEY, DEFAULT_NOTIFICATIONS);
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  writeJson(NOTIFICATION_KEY, prefs);
  void communityApi.updateClientSettings({ notifications: prefs }).catch(() => undefined);
}

export function getUserPreferences(): UserPreferences {
  return readJson(PREFERENCES_KEY, DEFAULT_PREFERENCES);
}

export function saveUserPreferences(prefs: UserPreferences) {
  writeJson(PREFERENCES_KEY, prefs);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
    document.documentElement.classList.toggle("compact-mode", prefs.compactMode);
  }
  void communityApi.updateClientSettings({ preferences: prefs }).catch(() => undefined);
}

export function getSearchHistory(): string[] {
  return readJson<string[]>(SEARCH_HISTORY_KEY, []);
}

export function addSearchHistory(query: string, limit = 20) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const next = [trimmed, ...getSearchHistory().filter((item) => item !== trimmed)].slice(0, limit);
  writeJson(SEARCH_HISTORY_KEY, next);
  void communityApi.updateClientSettings({ searchHistory: next }).catch(() => undefined);
}

export function clearSearchHistory() {
  writeJson(SEARCH_HISTORY_KEY, []);
  void communityApi.updateClientSettings({ searchHistory: [] }).catch(() => undefined);
}

export function removeSearchHistoryItem(query: string) {
  const next = getSearchHistory().filter((item) => item !== query);
  writeJson(SEARCH_HISTORY_KEY, next);
  void communityApi.updateClientSettings({ searchHistory: next }).catch(() => undefined);
}

export async function hydrateClientSettingsFromServer() {
  try {
    const remote = await communityApi.getClientSettings();
    if (remote.notifications) {
      writeJson(NOTIFICATION_KEY, { ...DEFAULT_NOTIFICATIONS, ...remote.notifications });
    }
    if (remote.preferences) {
      const prefs = { ...DEFAULT_PREFERENCES, ...remote.preferences };
      writeJson(PREFERENCES_KEY, prefs);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
        document.documentElement.classList.toggle("compact-mode", prefs.compactMode);
      }
    }
    if (remote.searchHistory) {
      writeJson(SEARCH_HISTORY_KEY, remote.searchHistory);
    }
  } catch {
    // 未登录或网络失败时保留本机缓存
  }
}
