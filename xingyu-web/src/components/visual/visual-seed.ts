/** Stable, deterministic helpers for decorative UI visuals. */
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableVariant(value: string, count: number): number {
  if (count <= 0) return 0;
  const seed = stableHash(value);
  return ((seed ^ (seed >>> 11) ^ (seed >>> 19)) >>> 0) % count;
}
