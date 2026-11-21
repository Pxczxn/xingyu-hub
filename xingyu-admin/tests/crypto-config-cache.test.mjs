import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./render-date-loader.mjs', import.meta.url)
const { CryptoConfigCache, DISABLED_CRYPTO_CONFIG } = await import('../src/utils/crypto-config-cache.ts')

const enabled = { enabled: true, publicKey: 'pem', protocol: 'XYC1' }

test('concurrent get() shares one in-flight load', async () => {
  let loads = 0
  const cache = new CryptoConfigCache(async () => {
    loads += 1
    await new Promise((resolve) => setTimeout(resolve, 20))
    return { ok: true, data: enabled }
  })
  const [a, b] = await Promise.all([cache.get(), cache.get()])
  assert.equal(loads, 1)
  assert.deepEqual(a, enabled)
  assert.deepEqual(b, enabled)
  await cache.get()
  assert.equal(loads, 1)
})

test('failed load is not cached so the next call retries', async () => {
  let loads = 0
  const cache = new CryptoConfigCache(async () => {
    loads += 1
    if (loads === 1) {
      return { ok: false }
    }
    return { ok: true, data: enabled }
  })
  assert.deepEqual(await cache.get(), DISABLED_CRYPTO_CONFIG)
  assert.deepEqual(await cache.get(), enabled)
  assert.equal(loads, 2)
})

test('thrown load is treated as disabled and can retry', async () => {
  let loads = 0
  const cache = new CryptoConfigCache(async () => {
    loads += 1
    if (loads === 1) {
      throw new Error('network')
    }
    return { ok: true, data: enabled }
  })
  assert.deepEqual(await cache.get(), DISABLED_CRYPTO_CONFIG)
  assert.deepEqual(await cache.get(), enabled)
  assert.equal(loads, 2)
})

test('clear() drops cache and ignores an in-flight success', async () => {
  let loads = 0
  let resolveFirst
  const cache = new CryptoConfigCache(() => {
    loads += 1
    if (loads === 1) {
      return new Promise((resolve) => {
        resolveFirst = resolve
      })
    }
    return Promise.resolve({ ok: true, data: { ...enabled, publicKey: 'fresh' } })
  })
  const pending = cache.get()
  cache.clear()
  resolveFirst({ ok: true, data: enabled })
  assert.deepEqual(await pending, enabled)
  assert.equal((await cache.get()).publicKey, 'fresh')
  assert.equal(loads, 2)
})
