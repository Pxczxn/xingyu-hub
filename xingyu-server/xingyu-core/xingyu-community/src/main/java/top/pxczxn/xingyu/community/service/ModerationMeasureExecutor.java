package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.ModerationDecision;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.ModerationDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
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
    private final ModerationMeasureMapper measureMapper;
    private final ModerationDecisionMapper decisionMapper;
    private final SearchIndexService searchIndexService;

    @Transactional
    public void apply(ModerationMeasure measure) {
        if (measure == null || !MEASURE_HIDE.equals(measure.getMeasureType())) {
            return;
        }
        hideTarget(measure);
    }

    @Transactional
    public void revoke(ModerationMeasure measure) {
        if (measure == null || !MEASURE_HIDE.equals(measure.getMeasureType())) {
            return;
        }
        restoreTarget(measure);
    }

    private void hideTarget(ModerationMeasure measure) {
        String type = normalizeType(measure.getTargetType());
        String targetId = measure.getTargetId();
        if (type == null || targetId == null) {
            return;
        }
        Instant now = Instant.now();
        switch (type) {
            case "ARTICLE" -> hideArticle(measure, targetId, now);
            case "MOMENT" -> hideMoment(measure, targetId, now);
            case "COMMENT" -> hideComment(measure, targetId, now);
            default -> {
            }
        }
        syncSearchIndex(type, targetId);
    }

    private void restoreTarget(ModerationMeasure measure) {
        String type = normalizeType(measure.getTargetType());
        String targetId = measure.getTargetId();
        if (type == null || targetId == null) {
            return;
        }
        Instant now = Instant.now();
        switch (type) {
            case "ARTICLE" -> restoreArticle(measure, targetId, now);
            case "MOMENT" -> restoreMoment(measure, targetId, now);
            case "COMMENT" -> restoreComment(measure, targetId, now);
            default -> {
            }
        }
        syncSearchIndex(type, targetId);
    }

    /**
     * 文章的编辑状态和生命周期不动。只记录治理状态，并把仍可公开的 NORMAL / FROZEN 收成 HIDDEN。
     * FROZEN 对读者仍可读，所以隐藏必须记下它，恢复时写回 FROZEN，而不是写成 NORMAL。
     */
    private void hideArticle(ModerationMeasure measure, String targetId, Instant now) {
        Article article = lockArticle(targetId);
        if (article == null) {
            rememberPriorStatus(measure, null);
            return;
        }
        String prior = article.getModerationStatus();
        rememberPriorStatus(measure, prior);
        if (!ArticleStateSupport.MODERATION_NORMAL.equals(prior)
                && !ArticleStateSupport.MODERATION_FROZEN.equals(prior)) {
            return;
        }
        writeArticleModeration(targetId, prior, ArticleStateSupport.MODERATION_HIDDEN, now);
    }

    /**
     * 先锁文章，再锁该文章上的隐藏措施。其他有效隐藏还在时不改治理状态。
     * 最后一项只在当前仍是 HIDDEN，且各措施记下的治理原状态同为 NORMAL 或同为 FROZEN 时写回。
     * 空的 prior_status 不补成 NORMAL。编辑状态和生命周期不在这次写入里。
     */
    private void restoreArticle(ModerationMeasure measure, String targetId, Instant now) {
        Article article = lockArticle(targetId);
        if (article == null) {
            return;
        }
        measureMapper.lockHideMeasures("ARTICLE", targetId);
        if (countOtherActiveHides(measure, "ARTICLE", targetId) > 0) {
            return;
        }
        String prior = chooseRestorablePrior("ARTICLE", targetId);
        if (prior == null || !ArticleStateSupport.MODERATION_HIDDEN.equals(article.getModerationStatus())) {
            return;
        }
        writeArticleModeration(targetId, article.getModerationStatus(), prior, now);
    }

    /**
     * 只改治理状态和更新时间。条件使用加锁时读到的当前值，避免覆盖作者同时写入的
     * 生命周期、编辑状态、分类或归属。
     */
    private void writeArticleModeration(String targetId, String observed, String next, Instant now) {
        LambdaUpdateWrapper<Article> update = new LambdaUpdateWrapper<Article>()
                .eq(Article::getId, targetId)
                .set(Article::getModerationStatus, next)
                .set(Article::getUpdatedAt, now);
        if (observed == null) {
            update.isNull(Article::getModerationStatus);
        } else {
            update.eq(Article::getModerationStatus, observed);
        }
        articleMapper.update(null, update);
    }

    private Article lockArticle(String articleId) {
        List<Article> rows = articleMapper.selectList(new LambdaQueryWrapper<Article>()
                .eq(Article::getId, articleId)
                .last("FOR UPDATE"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 只把仍在公开的动态收进治理隐藏。回收等其他状态原样留下，并记在措施上。
     */
    private void hideMoment(ModerationMeasure measure, String targetId, Instant now) {
        Moment moment = lockMoment(targetId);
        if (moment == null) {
            rememberPriorStatus(measure, null);
            return;
        }
        String prior = moment.getStatus();
        rememberPriorStatus(measure, prior);
        if (!"PUBLISHED".equals(prior)) {
            return;
        }
        momentMapper.update(null, new LambdaUpdateWrapper<Moment>()
                .eq(Moment::getId, targetId)
                .eq(Moment::getStatus, "PUBLISHED")
                .set(Moment::getStatus, "HIDDEN")
                .set(Moment::getUpdatedAt, now));
    }

    /**
     * 只把仍可见的评论收进治理隐藏。已删除的评论保持 DELETED。
     */
    private void hideComment(ModerationMeasure measure, String targetId, Instant now) {
        Comment comment = lockComment(targetId);
        if (comment == null) {
            rememberPriorStatus(measure, null);
            return;
        }
        String prior = comment.getStatus();
        rememberPriorStatus(measure, prior);
        if (!"VISIBLE".equals(prior)) {
            return;
        }
        commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                .eq(Comment::getId, targetId)
                .eq(Comment::getStatus, "VISIBLE")
                .set(Comment::getStatus, "HIDDEN")
                .set(Comment::getUpdatedAt, now));
    }

    /**
     * 认定违规插入措施之前先锁动态。锁顺序与申诉批准一致：案件，然后动态，然后措施行。
     */
    public void lockMomentTarget(String momentId) {
        lockMoment(momentId);
    }

    /**
     * 先锁动态，再锁该动态上的隐藏措施，然后读取仍然有效的其他隐藏。
     * 还有时不改状态，索引随后按仍为 HIDDEN 的行重新推导，不会写回公开。
     * 只剩这一项时，当前仍是 HIDDEN，且各措施记下的可恢复状态一致，才写回。
     * 有空的 prior_status，或可恢复状态互相矛盾，都不猜测。TRASHED 不会被写成 PUBLISHED。
     */
    private void restoreMoment(ModerationMeasure measure, String targetId, Instant now) {
        Moment moment = lockMoment(targetId);
        if (moment == null) {
            return;
        }
        measureMapper.lockHideMeasures("MOMENT", targetId);
        if (countOtherActiveHides(measure, "MOMENT", targetId) > 0) {
            return;
        }
        String prior = chooseRestorablePrior("MOMENT", targetId);
        if (prior == null || !"HIDDEN".equals(moment.getStatus())) {
            return;
        }
        momentMapper.update(null, new LambdaUpdateWrapper<Moment>()
                .eq(Moment::getId, targetId)
                .eq(Moment::getStatus, "HIDDEN")
                .set(Moment::getStatus, prior)
                .set(Moment::getUpdatedAt, now));
    }

    /**
     * 评论的删除是作者状态，不是隐藏措施的反面。先锁评论，再锁隐藏措施。
     * 其他有效隐藏还在时保持 HIDDEN。最后一项只把 HIDDEN 写回 VISIBLE。
     * DELETED 不会被写成 VISIBLE，也不会在恢复时被覆盖。
     */
    private void restoreComment(ModerationMeasure measure, String targetId, Instant now) {
        Comment comment = lockComment(targetId);
        if (comment == null) {
            return;
        }
        measureMapper.lockHideMeasures("COMMENT", targetId);
        if (countOtherActiveHides(measure, "COMMENT", targetId) > 0) {
            return;
        }
        String prior = chooseRestorablePrior("COMMENT", targetId);
        if (prior == null || !"HIDDEN".equals(comment.getStatus())) {
            return;
        }
        commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                .eq(Comment::getId, targetId)
                .eq(Comment::getStatus, "HIDDEN")
                .set(Comment::getStatus, prior)
                .set(Comment::getUpdatedAt, now));
    }

    /**
     * 可写回的原状态按目标自己的状态语义取。HIDDEN 是本次隐藏的结果，不能当成原状态。
     * 动态保留 PUBLISHED 与 TRASHED：当前已不是 HIDDEN 时调用方不会写。
     * 文章只接受治理状态 NORMAL / FROZEN。评论只接受 VISIBLE，DELETED 留在作者删除语义里。
     */
    private static String restorableFor(String targetType, String prior) {
        if (prior == null || prior.isBlank() || "HIDDEN".equals(prior)) {
            return null;
        }
        return switch (targetType) {
            case "MOMENT" -> prior;
            case "ARTICLE" -> (ArticleStateSupport.MODERATION_NORMAL.equals(prior)
                    || ArticleStateSupport.MODERATION_FROZEN.equals(prior)) ? prior : null;
            case "COMMENT" -> "VISIBLE".equals(prior) ? prior : null;
            default -> null;
        };
    }

    private long countOtherActiveHides(ModerationMeasure measure, String targetType, String targetId) {
        String caseId = null;
        if (measure.getDecisionId() != null) {
            ModerationDecision decision = decisionMapper.selectById(measure.getDecisionId());
            if (decision != null) {
                caseId = decision.getCaseId();
            }
        }
        Long count = measureMapper.countOtherActiveHides(targetType, targetId, caseId, measure.getId());
        return count == null ? 0L : count;
    }

    /**
     * 同一目标上全部隐藏措施记下的原状态。空值表示当时没有记录，不能补成公开。
     * 后一次隐藏看到的往往已是 HIDDEN，真正的原状态在更早的措施上。
     */
    private String chooseRestorablePrior(String targetType, String targetId) {
        Long missing = measureMapper.countUnrecordedHidePriors(targetType, targetId);
        if (missing != null && missing > 0) {
            return null;
        }
        List<String> recorded = measureMapper.listRecordedHidePriors(targetType, targetId);
        String chosen = null;
        for (String prior : recorded) {
            String restorable = restorableFor(targetType, prior);
            if (restorable == null) {
                continue;
            }
            if (chosen == null) {
                chosen = restorable;
                continue;
            }
            if (!chosen.equals(restorable)) {
                return null;
            }
        }
        return chosen;
    }

    private void rememberPriorStatus(ModerationMeasure measure, String prior) {
        measure.setPriorStatus(prior);
        if (measure.getId() == null) {
            return;
        }
        measureMapper.update(null, new LambdaUpdateWrapper<ModerationMeasure>()
                .eq(ModerationMeasure::getId, measure.getId())
                .set(ModerationMeasure::getPriorStatus, prior));
    }

    private Moment lockMoment(String momentId) {
        List<Moment> rows = momentMapper.selectList(new LambdaQueryWrapper<Moment>()
                .eq(Moment::getId, momentId)
                .last("FOR UPDATE"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Comment lockComment(String commentId) {
        List<Comment> rows = commentMapper.selectList(new LambdaQueryWrapper<Comment>()
                .eq(Comment::getId, commentId)
                .last("FOR UPDATE"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static String normalizeType(String targetType) {
        if (targetType == null || targetType.isBlank()) {
            return null;
        }
        return targetType.trim().toUpperCase(Locale.ROOT);
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
