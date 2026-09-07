/** MarsAdmin 分页结构：{ list, total, page, pageSize } */
export interface MarsPageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 通用分页结构：{ records, total, page, pageSize } */
export interface RecordsPageResult<T> {
  records: T[]
  total: number
  page: number
  pageSize: number
}

function asObject(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return null
}

/** 将接口返回值规范为数组，兼容加密解密后的多种包裹格式。 */
export function asApiList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload
  }
  const obj = asObject(payload)
  if (!obj) {
    return []
  }
  const nested = obj.data ?? obj.records ?? obj.items ?? obj.list
  if (Array.isArray(nested)) {
    return nested as T[]
  }
  return []
}

/** 将接口返回值规范为对象，兼容 { data: T } 包裹。 */
export function asApiRecord<T extends Record<string, unknown>>(payload: unknown): T {
  const obj = asObject(payload)
  if (!obj) {
    return {} as T
  }
  const nested = obj.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as T
  }
  return obj as T
}

/** 提取标量返回值（如未读数、布尔开关等）。 */
export function asApiValue<T>(payload: unknown): T {
  if (payload === null || payload === undefined) {
    return payload as T
  }
  if (typeof payload === 'number' || typeof payload === 'string' || typeof payload === 'boolean') {
    return payload as T
  }
  const obj = asObject(payload)
  if (!obj) {
    return payload as T
  }
  if ('data' in obj && (typeof obj.data === 'number' || typeof obj.data === 'string' || typeof obj.data === 'boolean')) {
    return obj.data as T
  }
  for (const key of ['value', 'count', 'total', 'unreadCount']) {
    if (key in obj) {
      return obj[key] as T
    }
  }
  return payload as T
}

/** MarsAdmin 分页：{ list, total } */
export function asMarsPage<T>(payload: unknown, fallbackPageSize = 20): MarsPageResult<T> {
  const obj = asObject(payload) ?? {}
  const list = asApiList<T>(obj.list ?? payload)
  return {
    list,
    total: Number(obj.total ?? obj.totalCount ?? list.length),
    page: Number(obj.page ?? obj.current ?? 1),
    pageSize: Number(obj.pageSize ?? obj.size ?? fallbackPageSize)
  }
}

/** 记录型分页：{ records, total } */
export function asApiPage<T>(payload: unknown, fallbackPageSize = 20): RecordsPageResult<T> {
  const obj = asObject(payload) ?? {}
  const records = asApiList<T>(obj.records ?? obj.items ?? obj.list ?? payload)
  return {
    records,
    total: Number(obj.total ?? obj.totalCount ?? records.length),
    page: Number(obj.page ?? obj.current ?? 1),
    pageSize: Number(obj.pageSize ?? obj.size ?? fallbackPageSize)
  }
}
