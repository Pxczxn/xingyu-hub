import { request, apiRecord, apiValue } from '@/utils/api-request'
import { asApiRecord } from '@/utils/api-data'

// ==================== 微信小程序 ====================

export interface MiniProgramLoginResult {
  openId: string
  unionId?: string
}

export interface PhoneResult {
  phone: string
}

// ==================== 微信公众号 ====================

export interface MpOAuthResult {
  openId: string
  unionId?: string
  nickname?: string
  headImgUrl?: string
  sex?: number
}

export const wechatApi = {
  // 小程序登录
  miniProgramLogin(code: string): Promise<MiniProgramLoginResult> {
    return request({ url: '/wechat/miniprogram/login', method: 'post', data: { code } }).then((payload) =>
      asApiRecord<MiniProgramLoginResult>(payload)
    )
  },

  // 获取小程序用户手机号
  getMiniProgramPhone(code: string): Promise<PhoneResult> {
    return request({ url: '/wechat/miniprogram/phone', method: 'post', data: { code } }).then((payload) =>
      asApiRecord<PhoneResult>(payload)
    )
  },

  // 获取公众号OAuth授权URL
  getOAuthUrl(redirectUri: string, state?: string, scope?: string): Promise<string> {
    return apiValue<string>({
      url: '/wechat/mp/oauth-url',
      method: 'get',
      params: { redirectUri, state: state || '', scope: scope || 'snsapi_userinfo' }
    })
  },

  // 公众号OAuth登录
  mpOAuthLogin(code: string): Promise<MpOAuthResult> {
    return request({ url: '/wechat/mp/oauth-login', method: 'post', data: { code } }).then((payload) =>
      asApiRecord<MpOAuthResult>(payload)
    )
  },

  // 同步菜单到微信
  syncMenu(menuConfig: string): Promise<void> {
    return request({ url: '/wechat/mp/menu/sync', method: 'post', data: { menuConfig } })
  },

  // 获取当前菜单
  getMenu(): Promise<string> {
    return apiValue<string>({ url: '/wechat/mp/menu', method: 'get' })
  },

  // 删除菜单
  deleteMenu(): Promise<void> {
    return request({ url: '/wechat/mp/menu', method: 'delete' })
  }
}
