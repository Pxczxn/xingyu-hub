import { RESPONSE_INFO_PREFIX, SESSION_INFO } from './protocol'

const HASH_LEN = 32

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
  return new Uint8Array(signature)
}

async function extract(ikm: Uint8Array, salt: Uint8Array | null): Promise<Uint8Array> {
  const actualSalt = salt && salt.length > 0 ? salt : new Uint8Array(HASH_LEN)
  return hmacSha256(actualSalt, ikm)
}

async function expand(prk: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const infoBytes = new TextEncoder().encode(info)
  const result = new Uint8Array(length)
  let previous = new Uint8Array(0)
  let offset = 0
  let counter = 1

  while (offset < length) {
    const payload = new Uint8Array(previous.length + infoBytes.length + 1)
    payload.set(previous, 0)
    payload.set(infoBytes, previous.length)
    payload[payload.length - 1] = counter
    previous = await hmacSha256(prk, payload)
    const copyLen = Math.min(previous.length, length - offset)
    result.set(previous.subarray(0, copyLen), offset)
    offset += copyLen
    counter += 1
  }

  return result
}

export async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array | null,
  info: string,
  length: number
): Promise<Uint8Array> {
  const prk = await extract(ikm, salt)
  return expand(prk, info, length)
}

export async function deriveSessionMasterKey(sharedSecret: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  return hkdfSha256(sharedSecret, salt, SESSION_INFO, 32)
}

export async function deriveResponseKey(sessionMasterKey: Uint8Array, requestId: string): Promise<Uint8Array> {
  return hkdfSha256(sessionMasterKey, null, `${RESPONSE_INFO_PREFIX}${requestId}`, 32)
}
