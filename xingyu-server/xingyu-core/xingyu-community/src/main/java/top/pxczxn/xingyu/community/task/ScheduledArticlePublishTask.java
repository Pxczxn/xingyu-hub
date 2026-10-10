package top.pxczxn.xingyu.community.task;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.service.ReviewService;

import java.time.Instant;
import java.util.List;

/**
 * 定时送审扫描（Studio Scheduling & Concurrency Recovery，2026-10-09 重构消费路径）。
 *
 * <p>消费逻辑移入 {@link ReviewService#submitScheduledDraft}：原子认领（条件 UPDATE 清列）
 * 与送审同事务——同一次计划绝不被重复消费，送审失败自动回滚等待下一轮重试。
 * 本类只负责「找出到期计划 + 逐条交给 ReviewService」，不再自行清列（旧实现在这里
 * 用 updateById 清 NULL 被 NOT_NULL 策略吞掉，导致计划残留与批准后重复送审循环，已实测）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledArticlePublishTask {

    private final WorkingDraftMapper draftMapper;
    private final ReviewService reviewService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void publishDueArticles() {
        List<WorkingDraft> dueDrafts = draftMapper.listDueScheduledPublish(Instant.now(), 20);
        for (WorkingDraft draft : dueDrafts) {
            try {
                reviewService.submitScheduledDraft(draft.getArticleId());
            } catch (Exception ex) {
                log.warn("定时发布文章失败 articleId={}", draft.getArticleId(), ex);
            }
        }
    }
}
