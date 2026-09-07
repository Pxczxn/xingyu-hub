import type { AxiosRequestConfig } from 'axios'
import { request as baseRequest } from './request'
import {
  asApiList,
  asApiPage,
  asApiRecord,
  asApiValue,
  asMarsPage,
  type MarsPageResult,
  type RecordsPageResult
} from './api-data'

export type { MarsPageResult, RecordsPageResult }

/** 原始请求（写操作或无需解析的接口）。 */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return baseRequest<T>(config)
}

/** 列表接口：解密后规范为 T[]。 */
export function apiList<T>(config: AxiosRequestConfig): Promise<T[]> {
  return baseRequest(config).then((data) => asApiList<T>(data))
}

/** MarsAdmin 分页：解密后规范为 { list, total }。 */
export function apiPage<T>(config: AxiosRequestConfig, fallbackPageSize = 20): Promise<MarsPageResult<T>> {
  return baseRequest(config).then((data) => asMarsPage<T>(data, fallbackPageSize))
}

/** 记录型分页：解密后规范为 { records, total }。 */
export function apiRecordsPage<T>(config: AxiosRequestConfig, fallbackPageSize = 20): Promise<RecordsPageResult<T>> {
  return baseRequest(config).then((data) => asApiPage<T>(data, fallbackPageSize))
}

/** 单对象接口：解密后规范为对象。 */
export function apiRecord<T extends Record<string, unknown>>(config: AxiosRequestConfig): Promise<T> {
  return baseRequest(config).then((data) => asApiRecord<T>(data))
}

/** 标量接口：解密后规范为 number / string / boolean 等。 */
export function apiValue<T>(config: AxiosRequestConfig): Promise<T> {
  return baseRequest(config).then((data) => asApiValue<T>(data))
}
