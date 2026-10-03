import { apiRecord } from '@/utils/api-request'

/*
 * 搜索索引运维接口（管理端）。
 *
 * 后端在 `/api/v1/admin/community/search-index/**`，返回管理端统一包装 Result<T>：
 * `{ code, message, data }`。契约已逐层核对：
 *   - `utils/request.ts` 的响应拦截器判 `res.code !== 200` 即报错，
 *     而后端 `Result.ok` 正好设 `code = 200`（xingyu-server .../common/result/Result.java:23）✓
 *   - `asApiRecord`（utils/api-data.ts:41-51）的逻辑是「有嵌套 `.data` 就剥一层，否则原样返回」，
 *     所以无论拦截器剥没剥过都能正确解包 ✓
 *
 * ⚠️ 三个接口返回的都是【对象】，所以三个都用 `apiRecord`，**不要用 `apiValue`**：
 * `asApiValue`（utils/api-data.ts:54-68）只认标量、或 `data` 是标量、或键名命中
 * `value / count / total / unreadCount` —— 而全量重建返回的是 `{ queued: N }`，
 * 是个对象，`apiValue` 取不到它。
 *
 * ⚠️ 下面三个类型必须用 **`type` 别名而不是 `interface`**：
 * `apiRecord<T extends Record<string, unknown>>` 带泛型约束，而 TypeScript 里
 * `interface` 不满足 `Record<string, unknown>`（只有 `type` 别名对对象字面量隐式带索引签名）。
 * 写成 interface 会直接编译不过 —— 而管理端目前**没有可用的类型检查门禁**
 * （vue-tsc 1.8.27 与 typescript 5.9.3 不兼容，npx vue-tsc@2 也因 exports 报错），
 * 所以这个错会一直潜伏到运行时。改动这里时请手动确认类型形状。
 */

/** 索引健康读数：投影（存量）+ 事件队列（流量）。两组必须一起看。 */
export type SearchIndexHealth = {
  /** 当前在索引里的行数。 */
  indexed: number
  /** 被标记为「非公开」但保留着的行数（重新发布会恢复）。 */
  removed: number
  /** 事件队列里排队 / 处理中的条数。 */
  pendingEvents: number
  /** 失败但会重试的条数。 */
  failedEvents: number
  /** 死信：消费者已放弃的事件，需人工介入。这是唯一需要人工判断的指标。 */
  isolatedEvents: number
}

/**
 * 全量重建的入队回执。
 *
 * ⚠️ `queued` 是**排队条数，不是改动行数** —— 此刻还没有任何消费发生。
 * 后端消费速率固定 4 条/秒（BATCH_SIZE=20 / 5s 轮询），所以队列会先涨到 N 再线性下降，
 * 页面只能通过 health 的 `pendingEvents` 观察进度。不要把它渲染成「已完成 N 条」。
 */
export type SearchIndexRebuildQueued = {
  queued: number
}

/** 单资源重建的回执。该接口是**同步**执行，失败会直接抛错。 */
export type SearchIndexRebuildOneResult = {
  objectType: string
  objectId: string
  status: string
}

/** 可重建的对象类型。与后端 `SearchIndexService` 的三个常量一致。 */
export type SearchIndexObjectType = 'ARTICLE' | 'SERIES' | 'MOMENT'

const BASE = '/community/search-index'

export const searchIndexApi = {
  /** 索引健康读数。轮询用（建议 10–15s，且页面可见时才轮询）。 */
  health(): Promise<SearchIndexHealth> {
    return apiRecord<SearchIndexHealth>({ url: `${BASE}/health`, method: 'get' })
  },

  /**
   * 全量重建：**只入队，不同步执行**。
   *
   * 幂等 —— 重复提交不会产生额外副作用，但会重复排队。
   * 因此 UI 应该在点击后进入冷却态，而**不是禁用**（运营可能有理由再点）。
   */
  rebuildAll(): Promise<SearchIndexRebuildQueued> {
    return apiRecord<SearchIndexRebuildQueued>({ url: `${BASE}/rebuild`, method: 'post' })
  },

  /**
   * 单资源重建：**同步**执行，失败直接抛错（调用方需就地反馈成功/失败）。
   *
   * 两个路径段都做 encodeURIComponent —— objectId 是 UUID 本来安全，
   * 但拼路径时不做编码是同类 bug 的温床。
   */
  rebuildOne(
    objectType: SearchIndexObjectType,
    objectId: string
  ): Promise<SearchIndexRebuildOneResult> {
    return apiRecord<SearchIndexRebuildOneResult>({
      url: `${BASE}/rebuild/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      method: 'post'
    })
  }
}
