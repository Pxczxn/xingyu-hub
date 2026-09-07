import axios from 'axios'
import { deriveSessionMasterKey } from './hkdf'
import { deriveSharedSecret, exportPublicKeySpki, generateEphemeralKeyPair, importPublicKeySpki } from './ecdh'
import { PROTOCOL_VERSION } from './protocol'

interface ActiveCryptoSession {
  sessionId: string
  masterKey: Uint8Array
  expiresAt: number
}

let activeSession: ActiveCryptoSession | null = null
let handshakePromise: Promise<ActiveCryptoSession | null> | null = null
let clientPrivateKey: CryptoKey | null = null

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function getActiveCryptoSession(): ActiveCryptoSession | null {
  if (!activeSession) {
    return null
  }
  if (Date.now() > activeSession.expiresAt) {
    destroyCryptoSession()
    return null
  }
  return activeSession
}

export function destroyCryptoSession() {
  activeSession = null
  clientPrivateKey = null
  handshakePromise = null
}

export async function establishCryptoSession(force = false): Promise<ActiveCryptoSession | null> {
  if (!force) {
    const current = getActiveCryptoSession()
    if (current) {
      return current
    }
    if (handshakePromise) {
      return handshakePromise
    }
  }

  handshakePromise = (async () => {
    const keyPair = await generateEphemeralKeyPair()
    clientPrivateKey = keyPair.privateKey
    const clientPublicKey = await exportPublicKeySpki(keyPair.publicKey)
    const response = await axios.post('/api/v1/admin/crypto/session/handshake', { clientPublicKey })
    if (response.data?.code !== 200) {
      throw new Error(response.data?.message || 'Crypto Session 握手失败')
    }
    const payload = response.data.data as {
      sessionId: string
      serverPublicKey: string
      salt: string
      expiresAt: number
      protocol: string
    }
    if (payload.protocol !== PROTOCOL_VERSION) {
      throw new Error(`不支持的加密协议: ${payload.protocol}`)
    }
    const serverPublicKey = await importPublicKeySpki(payload.serverPublicKey)
    const sharedSecret = await deriveSharedSecret(keyPair.privateKey, serverPublicKey)
    const masterKey = await deriveSessionMasterKey(sharedSecret, base64ToBytes(payload.salt))
    activeSession = {
      sessionId: payload.sessionId,
      masterKey,
      expiresAt: payload.expiresAt
    }
    return activeSession
  })()

  try {
    return await handshakePromise
  } finally {
    handshakePromise = null
  }
}

export async function invalidateCryptoSessionOnServer(sessionId?: string) {
  const sid = sessionId ?? activeSession?.sessionId
  if (!sid) {
    return
  }
  try {
    await axios.delete('/api/v1/admin/crypto/session', {
      headers: { 'X-Crypto-Session-Id': sid }
    })
  } catch {
    // 登出时忽略 session 销毁失败
  } finally {
    destroyCryptoSession()
  }
}
