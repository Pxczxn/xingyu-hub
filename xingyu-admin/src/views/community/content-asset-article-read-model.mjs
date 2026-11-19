/**
 * 文章运营读模型的展示文案。true、false、null 和缺失分开，缺失不得当成业务结论。
 */

export function articlePublicationLabel(hasPublishedRevision) {
  if (hasPublishedRevision === true) return '有正式发布版本'
  if (hasPublishedRevision === false) return '没有发布版本'
  return '不可判断'
}

export function articleVisibilityLabel(hasPublishedRevision, visibility) {
  if (visibility === 'PUBLIC') return '公开列出'
  if (visibility === 'UNLISTED') return '链接可读，不进搜索'
  if (visibility === 'PRIVATE') return '仅作者'
  if (hasPublishedRevision === false && visibility === null) return '没有发布版本'
  return '不可判断'
}

export function articleAnonymousLabel(readable) {
  if (readable === true) return '匿名可读'
  if (readable === false) return '匿名不可读'
  return '不可判断'
}
