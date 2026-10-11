# Admin 类型错误基线（vue-tsc --noEmit，typescript 5.4.5，2026-10-11）

总计 118 个 / 36 文件

## 高风险（api/stores/星系管理）: 0

## 泛型约束不匹配（TS2344，接口无 index signature）: 34
- src/api/auth.ts:91 TS2344
- src/api/auth.ts:113 TS2344
- src/api/auth.ts:136 TS2344
- src/api/auth.ts:144 TS2344
- src/api/customer.ts:35 TS2344
- src/api/gen.ts:76 TS2344
- src/api/message.ts:38 TS2344
- src/api/message.ts:128 TS2344
- src/api/message.ts:242 TS2344
- src/api/monitor.ts:114 TS2344
- src/api/monitor.ts:156 TS2344
- src/api/monitor.ts:212 TS2344
- src/api/operations.ts:41 TS2344
- src/api/org.ts:28 TS2344
- src/api/org.ts:63 TS2344
- src/api/org.ts:94 TS2344
- src/api/org.ts:130 TS2344
- src/api/org.ts:178 TS2344
- src/api/server.ts:48 TS2344
- src/api/system.ts:22 TS2344
- …（共 34 处，修复建议：工具函数泛型 T extends object 并放宽 asApiList 约束）

## unused 清理（TS6133）: 53 处（机械清理即可）
## 其它: 31
- src/api/topics.ts:30 TS2322 Type 'Promise<unknown[] | { id: string; aliasSlug: string; }[]>' is not assignable to type 'Promise<
- src/components/ProfileModal.vue:27 TS2339 Property 'mobile' does not exist on type '{ id?: number | undefined; username?: string | undefined; 
- src/components/ProfileModal.vue:65 TS2353 Object literal may only specify known properties, and 'mobile' does not exist in type 'Partial<Profi
- src/components/ProfileModal.vue:99 TS2353 Object literal may only specify known properties, and 'mobile' does not exist in type 'Partial<Profi
- src/components/ProfileModal.vue:99 TS2339 Property 'mobile' does not exist on type 'ProfileInfo'.
- src/components/ProfileModal.vue:118 TS2353 Object literal may only specify known properties, and 'mobile' does not exist in type 'Partial<Profi
- src/components/ProfileModal.vue:118 TS2339 Property 'mobile' does not exist on type '{ id?: number | undefined; username?: string | undefined; 
- src/stores/site.ts:42 TS2339 Property 'watermarkEnabled' does not exist on type '{ siteName: string; siteDescription: string; sit
- src/stores/site.ts:43 TS2339 Property 'watermarkType' does not exist on type '{ siteName: string; siteDescription: string; siteLo
- src/stores/site.ts:44 TS2339 Property 'watermarkCustomText' does not exist on type '{ siteName: string; siteDescription: string; 
- src/stores/site.ts:45 TS2339 Property 'watermarkOpacity' does not exist on type '{ siteName: string; siteDescription: string; sit
- src/utils/crypto.ts:91 TS2862 Type 'T' is generic and can only be indexed for reading.
- src/utils/request.ts:308 TS2345 Argument of type '(response: AxiosResponse<ApiResponse>) => Promise<unknown>' is not assignable to p
- src/views/community/events/index.vue:90 TS2322 Type 'number | null' is not assignable to type 'string | null'.
- src/views/community/events/index.vue:90 TS2322 Type 'number | null' is not assignable to type 'string | null'.
- src/views/community/governance-status.vue:52 TS7016 Could not find a declaration file for module './governance-status.logic.mjs'. 'D:/Coding/project/xin
- src/views/log/loginlog/index.vue:119 TS2345 Argument of type '{ username: string; status: number | null; page: number; pageSize: number; }' is n
- src/views/log/operlog/index.vue:160 TS2345 Argument of type '{ title: string; operName: string; status: number | null; page: number; pageSize: 
- src/views/monitor/api-access/index.vue:79 TS2322 Type '(row: ApiAccessLog) => number | undefined' is not assignable to type 'CreateRowKey<any>'.
- src/views/monitor/cache/index.vue:47 TS2322 Type 'string[]' is not assignable to type 'RowData[]'.
- src/views/monitor/cache/index.vue:215 TS18046 'res' is of type 'unknown'.
- src/views/monitor/cache/index.vue:215 TS18046 'res' is of type 'unknown'.
- src/views/monitor/cache/index.vue:215 TS18046 'res' is of type 'unknown'.
- src/views/monitor/job/index.vue:133 TS18047 '__VLS_ctx.cronPresetSelect' is possibly 'null'.
- src/views/monitor/job/index.vue:133 TS2551 Property 'value' does not exist on type 'string'. Did you mean 'valueOf'?
- src/views/monitor/job/index.vue:314 TS2345 Argument of type '{ jobName: string; jobGroup: string; status: number | null; page: number; pageSize
- src/views/monitor/server-manager/index.vue:268 TS2339 Property 'records' does not exist on type 'PageResult<Server>'.
- src/views/system/config/index.vue:1177 TS7006 Parameter 'row' implicitly has an 'any' type.
- src/views/system/customer/index.vue:51 TS7006 Parameter 'row' implicitly has an 'any' type.
- src/views/system/dict/index.vue:255 TS2345 Argument of type '{ dictName: string; dictType: string; status: number | null; page: number; pageSiz
- src/views/system/menu/index.vue:114 TS2322 Type 'string | undefined' is not assignable to type 'string'.