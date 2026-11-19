/** 编辑活动时只提交相对打开基线发生变化的字段。别名不参与更新。 */
export function eventUpdatePatch(original, current) {
  const patch = {}
  if (current.title !== original.title) patch.title = current.title
  if ((current.body || '') !== (original.body || '')) patch.body = current.body || ''
  if (current.status !== original.status) patch.status = current.status
  if (Boolean(current.submissionOpen) !== Boolean(original.submissionOpen)) {
    patch.submissionOpen = Boolean(current.submissionOpen)
  }
  if ((current.startsAt || null) !== (original.startsAt || null) && current.startsAt) {
    patch.startsAt = current.startsAt
  }
  if ((current.endsAt || null) !== (original.endsAt || null)) {
    patch.endsAt = current.endsAt || null
  }
  return patch
}
