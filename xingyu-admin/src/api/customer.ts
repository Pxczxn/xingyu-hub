import { request, apiPage, apiRecord } from '@/utils/api-request'
import type { PageResult } from './system'

// 客户表 类型定义
export interface Customer {
  id?: number

  name?:  string

  phone?:  string

  idCard?:  string

  address?:  string

  remark?:  string

  deleted?: number

  createTime?:  string

  updateTime?:  string

}

// 客户表 API
export const customerApi = {
  // 分页查询
  page(params: { page: number; pageSize: number; id?: number; name?:  string }): Promise<PageResult<Customer>> {
    return apiPage<Customer>({ url: '/system/customer/page', method: 'get', params })
  },

  // 获取详情
  detail(id: number): Promise<Customer> {
    return apiRecord<Customer>({ url: `/system/customer/${id}`, method: 'get' })
  },

  // 新增
  create(data: Customer) {
    return request({ url: '/system/customer', method: 'post', data })
  },

  // 修改
  update(data: Customer) {
    return request({ url: '/system/customer', method: 'put', data })
  },

  // 删除
  delete(ids: number[]) {
    return request({ url: `/system/customer/${ids.join(',')}`, method: 'delete' })
  }
}
