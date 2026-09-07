import { request, apiList, apiPage, apiRecord, apiRecordsPage } from '@/utils/api-request'
import { asApiRecord } from '@/utils/api-data'
import { PageResult } from './system'

// ==================== 部门管理 ====================
export interface SysDept {
  id?: number
  parentId: number
  ancestors?: string
  deptName: string
  sort: number
  leader?: string
  phone?: string
  email?: string
  status: number
  children?: SysDept[]
  createTime?: string
}

export const deptApi = {
  tree(params?: { deptName?: string; status?: number }): Promise<SysDept[]> {
    return apiList<SysDept>({ url: '/sys/dept/tree', method: 'get', params })
  },
  list(): Promise<SysDept[]> {
    return apiList<SysDept>({ url: '/sys/dept/list', method: 'get' })
  },
  detail(id: number): Promise<SysDept> {
    return apiRecord<SysDept>({ url: `/sys/dept/${id}`, method: 'get' })
  },
  create(data: SysDept): Promise<void> {
    return request({ url: '/sys/dept', method: 'post', data })
  },
  update(data: SysDept): Promise<void> {
    return request({ url: '/sys/dept', method: 'put', data })
  },
  delete(id: number): Promise<void> {
    return request({ url: `/sys/dept/${id}`, method: 'delete' })
  },
  move(id: number, parentId: number, sort?: number): Promise<void> {
    return request({ url: '/sys/dept/move', method: 'put', params: { id, parentId, sort } })
  }
}

// ==================== 岗位管理 ====================
export interface SysPost {
  id?: number
  postCode: string
  postName: string
  sort: number
  status: number
  remark?: string
  createTime?: string
}

export const postApi = {
  page(params: { page: number; pageSize: number; postCode?: string; postName?: string; status?: number }): Promise<PageResult<SysPost>> {
    return apiPage<SysPost>({ url: '/sys/post/page', method: 'get', params })
  },
  list(): Promise<SysPost[]> {
    return apiList<SysPost>({ url: '/sys/post/list', method: 'get' })
  },
  detail(id: number): Promise<SysPost> {
    return apiRecord<SysPost>({ url: `/sys/post/${id}`, method: 'get' })
  },
  create(data: SysPost): Promise<void> {
    return request({ url: '/sys/post', method: 'post', data })
  },
  update(data: SysPost): Promise<void> {
    return request({ url: '/sys/post', method: 'put', data })
  },
  delete(id: number): Promise<void> {
    return request({ url: `/sys/post/${id}`, method: 'delete' })
  }
}

// ==================== 字典类型 ====================
export interface SysDictType {
  id?: number
  dictName: string
  dictType: string
  status: number
  remark?: string
  createTime?: string
}

export const dictTypeApi = {
  page(params: { page: number; pageSize: number; dictName?: string; dictType?: string; status?: number }): Promise<PageResult<SysDictType>> {
    return apiPage<SysDictType>({ url: '/sys/dict/type/page', method: 'get', params })
  },
  list(): Promise<SysDictType[]> {
    return apiList<SysDictType>({ url: '/sys/dict/type/list', method: 'get' })
  },
  detail(id: number): Promise<SysDictType> {
    return apiRecord<SysDictType>({ url: `/sys/dict/type/${id}`, method: 'get' })
  },
  create(data: SysDictType): Promise<void> {
    return request({ url: '/sys/dict/type', method: 'post', data })
  },
  update(data: SysDictType): Promise<void> {
    return request({ url: '/sys/dict/type', method: 'put', data })
  },
  delete(id: number): Promise<void> {
    return request({ url: `/sys/dict/type/${id}`, method: 'delete' })
  }
}

// ==================== 字典数据 ====================
export interface SysDictData {
  id?: number
  sort: number
  dictLabel: string
  dictValue: string
  dictType: string
  cssClass?: string
  listClass?: string
  isDefault: number
  status: number
  remark?: string
  createTime?: string
}

export const dictDataApi = {
  page(params: { page: number; pageSize: number; dictType?: string; dictLabel?: string; status?: number }): Promise<PageResult<SysDictData>> {
    return apiPage<SysDictData>({ url: '/sys/dict/data/page', method: 'get', params })
  },
  listByType(dictType: string): Promise<SysDictData[]> {
    return apiList<SysDictData>({ url: `/sys/dict/data/type/${dictType}`, method: 'get' })
  },
  detail(id: number): Promise<SysDictData> {
    return apiRecord<SysDictData>({ url: `/sys/dict/data/${id}`, method: 'get' })
  },
  create(data: SysDictData): Promise<void> {
    return request({ url: '/sys/dict/data', method: 'post', data })
  },
  update(data: SysDictData): Promise<void> {
    return request({ url: '/sys/dict/data', method: 'put', data })
  },
  delete(id: number): Promise<void> {
    return request({ url: `/sys/dict/data/${id}`, method: 'delete' })
  }
}

// ==================== 系统配置分组 ====================
export interface SysConfigGroup {
  id?: number
  groupCode: string
  groupName: string
  groupIcon?: string
  configValue?: string
  sort?: number
  status?: number
  remark?: string
}

// 短信发送记录
export interface SmsLog {
  id: number
  phone: string
  content: string
  smsType: string
  templateId: string
  provider: string
  status: number // 0-发送中 1-成功 2-失败
  resultMsg: string
  bizId: string
  sendTime: string
  userId: number
  bizType: string
  ip: string
  createTime: string
}

export const configGroupApi = {
  list(): Promise<SysConfigGroup[]> {
    return apiList<SysConfigGroup>({ url: '/sys/config-group/list', method: 'get' })
  },
  getByCode(groupCode: string): Promise<SysConfigGroup> {
    return apiRecord<SysConfigGroup>({ url: `/sys/config-group/${groupCode}`, method: 'get' })
  },
  save(groupCode: string, config: Record<string, any>): Promise<void> {
    return request({ url: `/sys/config-group/${groupCode}`, method: 'post', data: config })
  },
  refresh(): Promise<void> {
    return request({ url: '/sys/config-group/refresh', method: 'post' })
  },
  // 获取公开配置（不需要登录）
  getPublicConfig(): Promise<{
    system: { siteName: string; siteDescription: string; siteLogo: string; copyright: string; icp: string }
    login: { captchaEnabled: boolean; captchaType: string; maxRetryCount: number; rememberMe: boolean }
    register: { enabled: boolean; verifyEmail: boolean; verifyPhone: boolean; needAudit: boolean; defaultRole: string }
    password: { minLength: number; maxLength: number; requireUppercase: boolean; requireLowercase: boolean; requireNumber: boolean; requireSpecial: boolean }
    storage: { maxSize: number; allowTypes: string }
    security: { disableDevtool: boolean }
  }> {
    return apiRecord({ url: '/sys/config-group/public', method: 'get' })
  },
  // 测试支付
  testPayment(type: 'wechat' | 'alipay'): Promise<{ orderNo: string; qrcode?: string; payUrl?: string }> {
    return request({ url: '/sys/config-group/test-payment', method: 'post', data: { type } }).then((payload) =>
      asApiRecord<{ orderNo: string; qrcode?: string; payUrl?: string }>(payload)
    )
  },
  // 测试发送邮件
  testEmail(to: string): Promise<void> {
    return request({ url: '/sys/config-group/test-email', method: 'post', data: { to } })
  },
  // 生成RSA密钥对
  generateKeys(): Promise<{ publicKey: string }> {
    return request({ url: '/sys/config-group/generate-keys', method: 'post' }).then((payload) =>
      asApiRecord<{ publicKey: string }>(payload)
    )
  },
  // 测试发送短信
  testSms(phone: string): Promise<void> {
    return request({ url: '/sys/config-group/test-sms', method: 'post', data: { phone } })
  },
  // 获取最近短信发送记录
  getRecentSmsLogs(limit?: number): Promise<SmsLog[]> {
    return apiList<SmsLog>({ url: '/sys/config-group/sms-logs/recent', method: 'get', params: { limit } })
  },
  // 分页查询短信发送记录
  getSmsLogs(params: { page: number; size: number; phone?: string; status?: number }): Promise<{ records: SmsLog[]; total: number; pages: number }> {
    return apiRecordsPage<SmsLog>({ url: '/sys/config-group/sms-logs', method: 'get', params }, params.size).then((page) => ({
      records: page.records,
      total: page.total,
      pages: Math.ceil(page.total / (page.pageSize || params.size || 20))
    }))
  }
}
