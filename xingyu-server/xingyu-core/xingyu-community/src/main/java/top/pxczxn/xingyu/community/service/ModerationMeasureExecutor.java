package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

/**
 * 将 ModerationMeasure 落到具体资源状态与搜索索引。
 *
 * <p>搜索索引不再由本类自己改：改为委托 {@link SearchIndexService#refresh} 重新推导。
 * 这同时修掉了一个此前一直潜伏的缺陷 —— 原来的恢复路径是
 * {@code document.setRemovedAt(null); searchDocumentMapper.updateById(document);}，
 * 而 MyBatis-Plus 默认的 NOT_NULL 字段策略会把值为 null 的字段**从 UPDATE 里省略**，
 * 所以 `removed_at` 从来没有被真正清掉，被恢复的内容会永久留在索引之外。
 * 那个缺陷一直没被发现，只是因为在这条索引链路补上之前，`search_document` 里根本没有行。
 */
@Service
@RequiredArgsConstructor
public class ModerationMeasureExecutor {

    public static final String MEASURE_HIDE = "HIDE_CONTENT";
    public static final String MEASURE_RESTORE = "RESTORE_CONTENT";

    private final ArticleMapper articleMapper;
    private final MomentMapper momentMapper;
    private final CommentMapper commentMapper;
    private final SearchIndexService searchIndexService;

    @Transactional
    public void apply(ModerationMeasure measure) {
        if (measure == null || !MEASURE_HIDE.equals(measure.getMeasureType())) {
            return;
        }
        hideTarget(measure.getTargetType(), measure.getTargetId());
    }

    @Transactional
    public void revoke(ModerationMeasure measure) {
        if (measure == null || !MEASURE_HIDE.equals(measure.getMeasureType())) {
            return;
        }
        restoreTarget(measure.getTargetType(), measure.getTargetId());
    }

    private void hideTarget(String targetType, String targetId) {
        if (targetType == null || targetId == null) {
            return;
        }
        String type = targetType.trim().toUpperCase(Locale.ROOT);
        Instant now = Instant.now();
        switch (type) {
            case "ARTICLE" -> {
                Article article = articleMapper.selectById(targetId);
                if (article != null) {
                    article.setModerationStatus(ArticleStateSupport.MODERATION_HIDDEN);
                    article.setUpdatedAt(now);
                    articleMapper.updateById(article);
                }
            }
            case "MOMENT" -> {
                Moment moment = momentMapper.selectById(targetId);
                if (moment != null) {
                    moment.setStatus("HIDDEN");
                    moment.setUpdatedAt(now);
                    momentMapper.updateById(moment);
                }
            }
            case "COMMENT" -> {
                Comment comment = commentMapper.selectById(targetId);
                if (comment != null) {
                    comment.setStatus("HIDDEN");
                    comment.setUpdatedAt(now);
                    commentMapper.updateById(comment);
                }
            }
            default -> {
                // 其他对象类型暂只影响搜索索引
            }
        }
        syncSearchIndex(type, targetId);
    }

    private void restoreTarget(String targetType, String targetId) {
        if (targetType == null || targetId == null) {
            return;
        }
        String type = targetType.trim().toUpperCase(Locale.ROOT);
        Instant now = Instant.now();
        switch (type) {
            case "ARTICLE" -> {
                Article article = articleMapper.selectById(targetId);
                if (article != null) {
                    article.setModerationStatus(ArticleStateSupport.MODERATION_NORMAL);
                    article.setUpdatedAt(now);
                    articleMapper.updateById(article);
                }
            }
            case "MOMENT" -> {
                Moment moment = momentMapper.selectById(targetId);
                if (moment != null && "HIDDEN".equals(moment.getStatus())) {
                    moment.setStatus("PUBLISHED");
                    moment.setUpdatedAt(now);
                    momentMapper.updateById(moment);
                }
            }
            case "COMMENT" -> {
                Comment comment = commentMapper.selectById(targetId);
                if (comment != null && "HIDDEN".equals(comment.getStatus())) {
                    comment.setStatus("ACTIVE");
                    comment.setUpdatedAt(now);
                    commentMapper.updateById(comment);
                }
            }
            default -> {
            }
        }
        syncSearchIndex(type, targetId);
    }

    /**
     * Re-derives the index state for the target instead of toggling it directly.
     *
     * <p>Authoritative on purpose: after the state change above, whether the object belongs in
     * the index is a question the index service can answer from the source of truth. That also
     * means hide and restore share one code path, so the two can never drift.
     *
     * <p>Types that are not indexed (COMMENT, and anything else) are a no-op — they were never
     * in `search_document` to begin with. This is a deliberate correction for SERIES: the old
     * code removed a series from the index on a hide measure, but nothing in the switch above
     * can actually hide a series, so the index used to disagree with what was still publicly
     * readable.
     */
    private void syncSearchIndex(String objectType, String objectId) {
        searchIndexService.refresh(objectType, objectId);
    }
}
