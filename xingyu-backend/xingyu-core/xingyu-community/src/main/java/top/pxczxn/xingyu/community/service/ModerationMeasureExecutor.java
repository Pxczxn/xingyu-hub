package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

/**
 * 将 ModerationMeasure 落到具体资源状态与搜索索引。
 */
@Service
@RequiredArgsConstructor
public class ModerationMeasureExecutor {

    public static final String MEASURE_HIDE = "HIDE_CONTENT";
    public static final String MEASURE_RESTORE = "RESTORE_CONTENT";

    private final ArticleMapper articleMapper;
    private final MomentMapper momentMapper;
    private final CommentMapper commentMapper;
    private final SearchDocumentMapper searchDocumentMapper;

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
        markSearchRemoved(type, targetId, now);
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
        markSearchRestored(type, targetId);
    }

    private void markSearchRemoved(String objectType, String objectId, Instant now) {
        SearchDocument document = searchDocumentMapper.findByObject(objectType, objectId);
        if (document != null && document.getRemovedAt() == null) {
            document.setRemovedAt(now);
            searchDocumentMapper.updateById(document);
        }
    }

    private void markSearchRestored(String objectType, String objectId) {
        SearchDocument document = searchDocumentMapper.findByObject(objectType, objectId);
        if (document != null && document.getRemovedAt() != null) {
            document.setRemovedAt(null);
            searchDocumentMapper.updateById(document);
        }
    }
}
