export type ProfileWorksViewMode = "grid" | "list";

const STORAGE_KEY = "xingyu-profile-works-view";
const PREFERENCE_KEY = "profileWorksGridView";

export function readProfileWorksViewMode(): ProfileWorksViewMode {
  if (typeof window === "undefined") return "grid";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "list" ? "list" : "grid";
}

export function writeProfileWorksViewMode(mode: ProfileWorksViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function profileWorksViewFromPreference(value: boolean | undefined): ProfileWorksViewMode | null {
  if (typeof value !== "boolean") return null;
  return value ? "grid" : "list";
}

export function profileWorksViewToPreference(mode: ProfileWorksViewMode): boolean {
  return mode === "grid";
}

export { PREFERENCE_KEY as PROFILE_WORKS_VIEW_PREFERENCE_KEY };
