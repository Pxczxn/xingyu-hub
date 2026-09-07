import { ALGORITHM, buildAad, type CryptoEnvelope } from './protocol'

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function decryptAesGcm(
  keyBytes: Uint8Array,
  envelope: CryptoEnvelope
): Promise<string> {
  if (envelope.alg !== ALGORITHM) {
    throw new Error(`不支持的加密算法: ${envelope.alg}`)
  }
  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const iv = base64ToBytes(envelope.nonce)
  const ciphertext = base64ToBytes(envelope.data)
  const aad = buildAad(envelope.sid, envelope.rid, envelope.ts)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    aesKey,
    ciphertext
  )
  return new TextDecoder().decode(plaintext)
}
