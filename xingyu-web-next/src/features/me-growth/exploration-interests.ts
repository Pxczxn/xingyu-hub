import type { ExploreDomain, UserExplore } from "@/api/exploration/exploration.types";
import { MAX_CUSTOM_LABELS, MAX_CUSTOM_LABEL_LENGTH } from "@/api/exploration/exploration.types";

/*
 * Pure logic for /me/interests (我的探索) — Phase 3D.
 *
 * Kept out of the component so the tricky rules are testable without a DOM.
 * The rules below all come from reading `ExplorationService`, not from guessing.
 */

/** One selectable official domain, flattened to the leaf level. */
export type SelectableDomain = {
  id: string;
  name: string;
  /** Owning group's display name, for the search index / disambiguation. */
  groupName: string;
  description: string | null;
};

/**
 * Flatten the official map to its CHILDREN only.
 *
 * Why children and not the roots: the write endpoint accepts any `SYSTEM`
 * domain id (`ExplorationService:147`), but Legacy's page only ever offered the
 * leaves (`map.flatMap(g => g.children ?? [])`). The roots are taxonomy
 * headings ("技术", "设计") — offering them as interests would produce a much
 * coarser selection than the backend was designed around. Mirror Legacy.
 *
 * A root with NO children contributes nothing (rather than silently promoting
 * itself to a selectable leaf) — `hasSelectableDomains` reports that state so
 * the page can say the map is empty instead of rendering a blank screen.
 */
export function flattenSelectableDomains(map: ExploreDomain[]): SelectableDomain[] {
  return map.flatMap((group) =>
    (group.children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      groupName: group.name,
      description: child.description ?? null,
    })),
  );
}

/** True when the official map yielded at least one selectable leaf. */
export function hasSelectableDomains(map: ExploreDomain[]): boolean {
  return flattenSelectableDomains(map).length > 0;
}

/**
 * The ids to pre-select for the checkbox UI.
 *
 * Filters out `personal` entries: a personal domain ALSO gets a link row
 * (`ExplorationService:186-192`), so it appears in `domains` too — but it
 * belongs to the custom-label list, not the official checkboxes. Without this
 * filter a personal label would render twice AND could be "selected" as if it
 * were official.
 */
export function selectedOfficialIds(mine: UserExplore | null): string[] {
  if (!mine) return [];
  return mine.domains.filter((domain) => !domain.personal).map((domain) => domain.id);
}

/**
 * Personal labels from the response.
 *
 * `customLabels` is the server's own derivation (`personal.stream().map(name)`)
 * so it is authoritative. We fall back to reading `personal` domains only if
 * `customLabels` is somehow absent — and we de-duplicate, because the server's
 * list is built from rows and a repeated row would otherwise render twice.
 */
export function personalLabels(mine: UserExplore | null): string[] {
  if (!mine) return [];
  const raw = Array.isArray(mine.customLabels)
    ? mine.customLabels
    : mine.domains.filter((domain) => domain.personal).map((domain) => domain.name);
  return dedupeLabels(raw);
}

/** Trim, drop blanks, de-dupe (case-insensitive) while preserving input order. */
export function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const value = (label ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export type AddLabelResult =
  | { ok: true; labels: string[] }
  | { ok: false; reason: "empty" | "too_long" | "duplicate" | "too_many"; message: string };

/**
 * Validate + append a personal label.
 *
 * Each `reason` exists so the page can point at the offending input with the
 * right message, rather than one generic "添加失败". The bounds are front-end
 * guards (see the constants' doc comment) — the backend has no cap, so without
 * these a user could keep adding rows indefinitely.
 */
export function addLabel(current: string[], raw: string): AddLabelResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty", message: "请输入兴趣名称" };
  if (value.length > MAX_CUSTOM_LABEL_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `兴趣名称不超过 ${MAX_CUSTOM_LABEL_LENGTH} 个字符`,
    };
  }
  const key = value.toLowerCase();
  if (current.some((label) => label.toLowerCase() === key)) {
    return { ok: false, reason: "duplicate", message: "该兴趣已添加" };
  }
  if (current.length >= MAX_CUSTOM_LABELS) {
    return { ok: false, reason: "too_many", message: `最多添加 ${MAX_CUSTOM_LABELS} 个个人兴趣` };
  }
  return { ok: true, labels: [...current, value] };
}

/** Remove a label by exact value. Unknown values are a no-op (ids, not indices). */
export function removeLabel(current: string[], target: string): string[] {
  return current.filter((label) => label !== target);
}

/** Toggle a domain id in a selection list. */
export function toggleId(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

/**
 * Did the user actually change anything?
 *
 * The PUT is a destructive full replacement, so an unchanged "保存" should not
 * fire it — but the comparison must be ORDER-INSENSITIVE for domains (the
 * selection is a set; reordering chips is not an edit) and order-sensitive for
 * labels (the label order is what the user sees, and the server's `sortOrder`
 * preserves it). Skipping the write also means we don't needlessly re-mint
 * personal rows.
 */
export function isDirty(
  initial: { domainIds: string[]; labels: string[] },
  current: { domainIds: string[]; labels: string[] },
): boolean {
  if (initial.labels.length !== current.labels.length) return true;
  for (let i = 0; i < initial.labels.length; i += 1) {
    if (initial.labels[i] !== current.labels[i]) return true;
  }
  const a = [...initial.domainIds].sort();
  const b = [...current.domainIds].sort();
  if (a.length !== b.length) return true;
  return a.some((id, index) => id !== b[index]);
}

/**
 * Turn an `ExploreDomain`-shaped `domains[]` entry into a chip label.
 * Defensive: a name-less row falls back to the slug, then a literal marker, so
 * a broken row renders as *something* identifiable rather than an empty chip.
 */
export function domainChipLabel(domain: ExploreDomain): string {
  const name = domain.name?.trim();
  if (name) return name;
  const slug = domain.slug?.trim();
  if (slug) return slug;
  return "未命名领域";
}
