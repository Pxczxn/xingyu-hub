import type { CryptoRuntimeConfig } from '@/utils/crypto/protocol'

export const DISABLED_CRYPTO_CONFIG: CryptoRuntimeConfig = {
  enabled: false,
  publicKey: '',
  protocol: 'XYC1'
}

export type CryptoConfigLoadResult =
  | { ok: true; data: CryptoRuntimeConfig }
  | { ok: false }

/**
 * Caches a successful crypto config and coalesces concurrent loads onto one Promise.
 * Failures are not cached so the next call retries. {@link clear} bumps a generation
 * so a load that started before logout cannot refill the cache.
 */
export class CryptoConfigCache {
  private cache: CryptoRuntimeConfig | null = null
  private inflight: Promise<CryptoRuntimeConfig> | null = null
  private generation = 0
  private readonly load: () => Promise<CryptoConfigLoadResult>

  constructor(load: () => Promise<CryptoConfigLoadResult>) {
    this.load = load
  }

  get(): Promise<CryptoRuntimeConfig> {
    if (this.cache) {
      return Promise.resolve(this.cache)
    }
    if (this.inflight) {
      return this.inflight
    }
    const generation = this.generation
    this.inflight = this.load()
      .then((result) => {
        if (!result.ok) {
          return DISABLED_CRYPTO_CONFIG
        }
        if (generation === this.generation) {
          this.cache = result.data
        }
        return result.data
      })
      .catch(() => DISABLED_CRYPTO_CONFIG)
      .finally(() => {
        if (generation === this.generation) {
          this.inflight = null
        }
      })
    return this.inflight
  }

  clear(): void {
    this.generation += 1
    this.cache = null
    this.inflight = null
  }
}
