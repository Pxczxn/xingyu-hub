/** 编辑指南时只提交相对打开基线发生变化的字段。别名不参与更新。 */
export function guideUpdatePatch(original, current) {
  const patch = {}
  if (current.title !== original.title) patch.title = current.title
  if (current.body !== original.body) patch.body = current.body
  if (current.status !== original.status) patch.status = current.status
  if (Number(current.sortOrder) !== Number(original.sortOrder)) {
    patch.sortOrder = current.sortOrder == null || current.sortOrder === '' ? null : String(current.sortOrder)
  }
  return patch
}
