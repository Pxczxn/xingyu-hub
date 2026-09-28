import { authApi } from "@/api/auth/auth.api";
import type { PublicConfig } from "@/api/auth/auth.types";

/*
 * Public config loader (migrated from Legacy lib/public-config.ts).
 * Short-lived cache so auth screens can request a fresh copy when the
 * registration/login switches must be current.
 */

let cache: PublicConfig | null = null;
let cacheAt = 0;
let inflight: Promise<PublicConfig> | null = null;

const CACHE_MS = 60_000;

export async function getPublicConfig(options?: { fresh?: boolean }): Promise<PublicConfig> {
  const fresh = options?.fresh === true;
  const now = Date.now();

  if (!fresh && cache && now - cacheAt < CACHE_MS) return cache;
  if (!fresh && inflight) return inflight;

  inflight = authApi.getPublicConfig().then((config) => {
    cache = config;
    cacheAt = Date.now();
    inflight = null;
    return config;
  });

  return inflight;
}

export function clearPublicConfigCache(): void {
  cache = null;
  cacheAt = 0;
  inflight = null;
}
