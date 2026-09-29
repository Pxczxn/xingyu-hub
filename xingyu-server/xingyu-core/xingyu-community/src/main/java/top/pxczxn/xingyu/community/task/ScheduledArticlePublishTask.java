package top.pxczxn.xingyu.community.task;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.service.ReviewService;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledArticlePublishTask {

    private final WorkingDraftMapper draftMapper;
    private final ArticleMapper articleMapper;
    private final CommunityUserMapper userMapper;
    private final ReviewService reviewService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void publishDueArticles() {
        List<WorkingDraft> dueDrafts = draftMapper.listDueScheduledPublish(Instant.now(), 20);
        for (WorkingDraft draft : dueDrafts) {
            try {
                Article article = articleMapper.selectById(draft.getArticleId());
                if (article == null) {
                    continue;
                }
                CommunityUser owner = userMapper.selectById(article.getOwnerId());
                if (owner == null) {
                    continue;
                }
                reviewService.submitForReview(owner, draft.getArticleId());
                draft.setScheduledPublishAt(null);
                draftMapper.updateById(draft);
            } catch (Exception ex) {
                log.warn("定时发布文章失败 articleId={}", draft.getArticleId(), ex);
            }
        }
    }
}
