package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.common.contract.access.AccessPolicy;
import top.pxczxn.xingyu.common.contract.access.AccessorContext;
import top.pxczxn.xingyu.common.contract.access.ResourceAccess;
import top.pxczxn.xingyu.common.contract.access.Visibility;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 文章公开读取的唯一判定（Phase 3.1，2026-10-19）。
 *
 * <p>在此之前，"这篇文章能不能读"存在两套实现：{@code ArticleService.getPublicArticle}
 * 走 {@link AccessPolicy}，而系列阅读进度的 {@code ReadingService.isReadableBy}
 * 只看生命周期 / 已发布版本 / 治理隐藏。后者因此会接受 PRIVATE 文章与审核中的文章，
 * 让非作者通过进度接口得到一篇详情接口拒绝的文章。
 *
 * <p>现在两条路径共用这一处判断。它只做判定并返回构造文章视图所需的三条记录，
 * 不构建 DTO、不读取正文，因此阅读进度只需要一个布尔值时不会触发完整文章链路。
 *
 * <p>顺序与 {@code getPublicArticle} 完全一致：存在性 → 生命周期 → 治理隐藏
 * （仅作者可越过）→ 已发布版本 → 正式版本 → {@link AccessPolicy} 的权限/审核裁决。
 * {@code ownerActive} 与 {@code resourceActive} 传 true，与文章详情现有契约一致。
 *
 * <p>注意：这里不提供"是否公开列出"的判断。UNLISTED 的语义是"直接链接可读、
 * 不出现在列表"，{@link AccessPolicy} 已经用 {@code allow(false)} 表达；调用方
 * 只关心"是否可读"，不得把 UNLISTED 当成 PRIVATE。
 */
@Service
@RequiredArgsConstructor
public class ArticleAccessService {

    private final ArticleMapper articleMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;

    /** The records a readable article view is built from; null when not readable. */
    public record ReadableArticle(Article article, PublishedRevision published, FormalRevision revision) {
    }

    /**
     * Resolves the article as this viewer may read it through the public article
     * route, or {@code null} when any step of the policy denies access.
     *
     * <p>Returning null for every denial is deliberate: callers surface a single
     * 404, so a denied request cannot distinguish "private" from "gone".
     */
    public ReadableArticle findReadable(String articleId, CommunityUser viewer) {
        Article article = articleMapper.selectById(articleId);
        if (article == null || !ArticleStateSupport.isActiveLifecycle(article)) {
            return null;
        }

        boolean isOwner = viewer != null && viewer.getId().equals(article.getOwnerId());
        // Governance suppression is owner-scoped in this product: HIDDEN articles
        // stay visible to their author (same pre-check as getPublicArticle).
        if (ArticleStateSupport.MODERATION_HIDDEN.equals(
                ArticleStateSupport.normalizeModeration(article.getModerationStatus())) && !isOwner) {
            return null;
        }

        PublishedRevision published = publishedRevisionMapper.findByArticleId(articleId);
        if (published == null) {
            return null;
        }
        FormalRevision revision = formalRevisionMapper.selectById(published.getFormalRevisionId());
        if (revision == null) {
            return null;
        }

        Visibility visibility = Visibility.valueOf(revision.getVisibility());
        var decision = AccessPolicy.evaluate(
                ResourceAccess.builder()
                        .exists(true)
                        .ownerId(ObjectId.of(article.getOwnerId()))
                        .visibility(visibility)
                        .ownerActive(true)
                        .resourceActive(true)
                        // The public route only ever serves the PUBLISHED revision (the one the
                        // pointer above resolved). An article being IN_REVIEW means its NEXT
                        // revision is under review — the published one is still the contract
                        // readers see, so "under review" must NOT hide it.
                        //
                        // A first-time submission has no published_revision row and already
                        // returned null above; passing false here cannot expose unreviewed text.
                        // This matches SearchIndexService.isDiscoverable, which also evaluates
                        // discovery with underReview(false) — search and read must agree.
                        .underReview(false)
                        .build(),
                isOwner
                        ? AccessorContext.authenticated(ObjectId.of(viewer.getId()))
                        : AccessorContext.anonymous());
        if (!decision.isAllowed()) {
            return null;
        }
        return new ReadableArticle(article, published, revision);
    }

    /** Convenience for callers that only need the decision. */
    public boolean isReadable(String articleId, CommunityUser viewer) {
        return findReadable(articleId, viewer) != null;
    }
}
