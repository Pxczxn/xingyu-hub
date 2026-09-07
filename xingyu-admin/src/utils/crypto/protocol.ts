export const PROTOCOL_VERSION = 'XYC1'
export const ALGORITHM = 'A256GCM'
export const SESSION_HEADER = 'X-Crypto-Session-Id'
export const REQUEST_HEADER = 'X-Crypto-Request-Id'
export const SESSION_INFO = 'xingyu-admin:session:v1'
export const RESPONSE_INFO_PREFIX = 'xingyu-admin:res:'

export interface CryptoEnvelope {
  v: string
  sid: string
  rid: string
  alg: string
  ts: number
  nonce: string
  data: string
}

export function isXyc1Envelope(data: unknown): data is CryptoEnvelope {
  if (!data || typeof data !== 'object') {
    return false
  }
  const envelope = data as CryptoEnvelope
  return envelope.v === PROTOCOL_VERSION
    && typeof envelope.sid === 'string'
    && typeof envelope.rid === 'string'
    && typeof envelope.alg === 'string'
    && typeof envelope.ts === 'number'
    && typeof envelope.nonce === 'string'
    && typeof envelope.data === 'string'
}

/** AAD: UTF-8 `XYC1|{sid}|{rid}|A256GCM|{ts}` */
export function buildAad(sid: string, rid: string, ts: number): Uint8Array {
  const text = `${PROTOCOL_VERSION}|${sid}|${rid}|${ALGORITHM}|${ts}`
  return new TextEncoder().encode(text)
}

export interface CryptoRuntimeConfig {
  enabled: boolean
  publicKey: string
  protocol: 'XYC1' | 'legacy' | string
}
