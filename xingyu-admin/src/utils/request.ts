import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'

import { useUserStore } from '@/stores/user'

import { decryptAesGcm } from '@/utils/crypto/aes-gcm'

import { deriveResponseKey } from '@/utils/crypto/hkdf'

import {

  ALGORITHM,

  isXyc1Envelope,

  PROTOCOL_VERSION,

  REQUEST_HEADER,

  SESSION_HEADER,

  type CryptoEnvelope,

  type CryptoRuntimeConfig

} from '@/utils/crypto/protocol'

import {

  destroyCryptoSession,

  establishCryptoSession,

  getActiveCryptoSession,

  invalidateCryptoSessionOnServer

} from '@/utils/crypto/session'



declare module 'axios' {

  export interface AxiosRequestConfig {

    cryptoRequestId?: string

    /** 为 true 时不弹出全局错误提示，由调用方自行处理。 */
    silentError?: boolean

  }

}



interface ApiResponse<T = unknown> {

  code: number

  message: string

  data: T

}



let cryptoConfigCache: CryptoRuntimeConfig | null = null



export async function fetchCryptoConfig(): Promise<CryptoRuntimeConfig> {

  if (cryptoConfigCache) {

    return cryptoConfigCache

  }

  try {

    const response = await axios.get('/api/v1/admin/crypto/config')

    if (response.data?.code === 200) {

      cryptoConfigCache = response.data.data as CryptoRuntimeConfig

      return cryptoConfigCache

    }

  } catch (error) {

    console.error('获取加密配置失败', error)

  }

  return { enabled: false, publicKey: '', protocol: 'XYC1' }

}



export function clearCryptoConfigCache() {

  cryptoConfigCache = null

  destroyCryptoSession()

}



export async function initCryptoRuntime(): Promise<void> {

  const config = await fetchCryptoConfig()

  if (config.enabled && config.protocol?.toUpperCase() === PROTOCOL_VERSION) {

    await establishCryptoSession(true)

  }

}



function splitLegacyEncryptedPayload(data: string): [string, string] | null {

  const splitAt = data.indexOf('.')

  if (splitAt <= 0 || splitAt >= data.length - 1) {

    return null

  }

  return [data.slice(0, splitAt), data.slice(splitAt + 1)]

}



function isLegacyEncryptedData(data: unknown): data is string {

  if (typeof data !== 'string') {

    return false

  }

  const parts = splitLegacyEncryptedPayload(data)

  if (!parts) {

    return false

  }

  try {

    atob(parts[0])

    atob(parts[1])

    return parts[0].length === 16 && parts[1].length > 10

  } catch {

    return false

  }

}



async function decryptLegacyResponse(_data: string): Promise<never> {

  throw new Error('legacy 响应加密已不再支持明文 AES 密钥下发，请将 encryptProtocol 切换为 XYC1')

}



async function decryptXyc1Envelope(envelope: CryptoEnvelope, requestId?: string): Promise<unknown> {

  const session = getActiveCryptoSession()

  if (!session) {

    throw new Error('Crypto Session 不存在或已过期，请刷新页面')

  }

  if (!requestId) {

    throw new Error('缺少请求标识，无法解密响应')

  }

  if (envelope.v !== PROTOCOL_VERSION) {

    throw new Error(`不支持的协议版本: ${envelope.v}`)

  }

  if (envelope.alg !== ALGORITHM) {

    throw new Error(`不支持的加密算法: ${envelope.alg}`)

  }

  if (envelope.sid !== session.sessionId) {

    throw new Error('响应 session 与当前会话不一致')

  }

  if (envelope.rid !== requestId) {

    throw new Error('响应 requestId 与当前请求不一致')

  }

  const responseKey = await deriveResponseKey(session.masterKey, requestId)

  const plaintext = await decryptAesGcm(responseKey, envelope)

  return JSON.parse(plaintext)

}



export const TOKEN_HEADER = 'satoken'



const service: AxiosInstance = axios.create({

  baseURL: '/api/v1/admin',

  timeout: 30000

})



service.interceptors.request.use(

  async (config) => {

    const userStore = useUserStore()

    if (userStore.token) {

      config.headers[TOKEN_HEADER] = userStore.token

    }



    const cryptoConfig = await fetchCryptoConfig()

    if (cryptoConfig.enabled && cryptoConfig.protocol?.toUpperCase() === PROTOCOL_VERSION) {

      let session = getActiveCryptoSession()

      if (!session) {

        session = await establishCryptoSession()

      }

      if (session) {

        const requestId = crypto.randomUUID()

        config.headers[SESSION_HEADER] = session.sessionId

        config.headers[REQUEST_HEADER] = requestId

        config.cryptoRequestId = requestId

      }

    }



    return config

  },

  (error) => Promise.reject(error)

)



let isLoggingOut = false



service.interceptors.response.use(

  async (response: AxiosResponse<ApiResponse>) => {

    if (response.config.responseType === 'blob') {

      return response.data

    }



    const res = response.data

    const requestId = response.config.cryptoRequestId



    if (res.code !== 200) {

      const isLogoutRequest = response.config.url?.includes('/auth/logout')

      if (res.code === 401 && !isLoggingOut && !isLogoutRequest) {

        isLoggingOut = true

        window.$message?.error('当前用户登录已过期，请重新登录')

        const userStore = useUserStore()

        await userStore.logout()

        isLoggingOut = false

        return Promise.reject(new Error('登录已过期'))

      }

      if (!isLogoutRequest && !response.config.silentError) {

        window.$message?.error(res.message || '请求失败')

      }

      return Promise.reject(new Error(res.message || '请求失败'))

    }



    if (isXyc1Envelope(res.data)) {

      const decrypted = await decryptXyc1Envelope(res.data, requestId)

      return decrypted

    }



    if (isLegacyEncryptedData(res.data)) {

      return await decryptLegacyResponse(res.data)

    }



    return res.data

  },

  (error) => {

    const message = error.response?.data?.message || error.message || '网络错误'

    if (!error.config?.silentError) {

      window.$message?.error(message)

    }

    return Promise.reject(error)

  }

)



export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {

  return service(config) as Promise<T>

}



export async function destroyAdminCryptoSession() {

  await invalidateCryptoSessionOnServer()

  clearCryptoConfigCache()

}



export default service


