package top.pxczxn.xingyu.admin.controller.community;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityEventMapper;
import top.pxczxn.xingyu.community.mapper.ModerationCaseMapper;
import top.pxczxn.xingyu.community.mapper.ReviewSubmissionMapper;

/**
 * 社区运营总览接口。
 *
 * <p>只返回运营决策需要的聚合数据，避免管理端为首页并发加载多张业务列表。</p>
 */
@RestController
@RequestMapping("/operations")
@RequiredArgsConstructor
public class OperationsOverviewController {

    private final ReviewSubmissionMapper reviewSubmissionMapper;
    private final ModerationCaseMapper moderationCaseMapper;
    private final ArticleMapper articleMapper;
    private final CommunityEventMapper communityEventMapper;

    @GetMapping("/overview")
    public Result<OperationsOverview> overview() {
        OperationsOverview overview = new OperationsOverview();
        overview.setPendingReviewCount(reviewSubmissionMapper.selectCount(
                new LambdaQueryWrapper<ReviewSubmission>()
                        .eq(ReviewSubmission::getStatus, "PENDING")));
        overview.setOpenCaseCount(moderationCaseMapper.selectCount(
                new LambdaQueryWrapper<ModerationCase>()
                        .eq(ModerationCase::getStatus, "OPEN")));
        overview.setPublishedArticleCount(articleMapper.selectCount(
                new LambdaQueryWrapper<Article>()
                        .eq(Article::getStatus, "PUBLISHED")));
        overview.setActiveEventCount(communityEventMapper.selectCount(
                new LambdaQueryWrapper<CommunityEvent>()
                        .eq(CommunityEvent::getStatus, "ACTIVE")));
        overview.setOpenReportCount(overview.getOpenCaseCount());
        overview.setActiveContentCount(overview.getPublishedArticleCount());
        return Result.ok(overview);
    }

    @Data
    public static class OperationsOverview {
        private Long pendingReviewCount;
        private Long openCaseCount;
        private Long publishedArticleCount;
        private Long activeEventCount;
        private Long openReportCount;
        private Long activeContentCount;
        private java.util.List<Object> recentItems = java.util.List.of();
    }
}
