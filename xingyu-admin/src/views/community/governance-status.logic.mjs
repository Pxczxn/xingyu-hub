/**
 * 群聊/举报/申诉队列的路由映射纯函数（Admin Security Gate Recovery Phase C）。
 *
 * 为什么抽出来：`/community/operations/groups` 复用 governance-status.vue，但后端
 * `AdminGroupController` 只有只读 `GET /operations/groups`，没有任何 decide 端点。
 * 此前的 kind 判定把 groups 路径当 reports 处理，导致"认定违规/驳回"按钮把
 * conversation UUID 发往 `/moderation/reports/{id}/decide` —— 必然 NOT_FOUND。
 * 修复：groups 一律只读（canDecide=false），端点映射收敛到本文件，配 node:test 回归
 * （package.json `test:audit` 同款 node --test，零新依赖）。
 */

/** 当前路由对应的队列类型：appeals / groups / reports。 */
export function queueKind(path) {
  if (path.endsWith('/appeals')) return 'appeals'
  if (path.endsWith('/groups')) return 'groups'
  return 'reports'
}

/** 群聊治理目前只有只读能力 —— 不提供无法兑现的决策入口。 */
export function canDecide(path) {
  return queueKind(path) !== 'groups'
}

/** 列表数据端点。 */
export function queueEndpoint(path) {
  switch (queueKind(path)) {
    case 'appeals':
      return '/moderation/appeals'
    case 'groups':
      return '/operations/groups'
    default:
      return '/moderation/reports'
  }
}

/** 决策提交端点（仅 canDecide 路径可调用）。 */
export function decideEndpoint(path, id) {
  return queueKind(path) === 'appeals'
    ? `/moderation/appeals/${id}/decide`
    : `/moderation/reports/${id}/decide`
}
