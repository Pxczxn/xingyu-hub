import { communityApi, type PublicConfig } from "@/lib/community-api";

let cache: PublicConfig | null = null;
let cacheAt = 0;
let inflight: Promise<PublicConfig> | null = null;

const CACHE_MS = 60_000;

type PublicConfigOptions = {
  /** 跳过缓存，用于登录/注册等需要最新开关的页面 */
  fresh?: boolean;
};

export async function getPublicConfig(options?: PublicConfigOptions): Promise<PublicConfig> {
  const fresh = options?.fresh === true;
  const now = Date.now();
  if (!fresh && cache && now - cacheAt < CACHE_MS) return cache;

  if (!fresh && inflight) return inflight;

  inflight = communityApi.getPublicConfig().then((config) => {
    cache = config;
    cacheAt = Date.now();
    inflight = null;
    return config;
  });

  return inflight;
}

export function clearPublicConfigCache() {
  cache = null;
  cacheAt = 0;
  inflight = null;
}
