package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.BadgeView;
import top.pxczxn.xingyu.community.dto.InsightsView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import top.pxczxn.xingyu.community.mapper.CreatorFollowMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MeEngagementService {

    private final ArticleMapper articleMapper;
    private final CreatorFollowMapper creatorFollowMapper;
    private final CommentMapper commentMapper;
    private final ContentLikeMapper likeMapper;
    private final CommunityProfileMapper profileMapper;
    private final OnboardingService onboardingService;

    public InsightsView insights(CommunityUser user) {
        List<Article> articles = articleMapper.listByOwnerId(user.getId());
        long published = articles.stream().filter(a -> "PUBLISHED".equals(a.getStatus())).count();
        long drafts = articles.stream().filter(a -> "DRAFT".equals(a.getStatus())).count();
        return new InsightsView(
                published,
                drafts,
                creatorFollowMapper.countFollowers(user.getId()),
                creatorFollowMapper.countFollowing(user.getId()),
                commentMapper.countByAuthorId(user.getId()),
                likeMapper.countByUserId(user.getId()));
    }

    public List<BadgeView> badges(CommunityUser user) {
        List<Article> articles = articleMapper.listByOwnerId(user.getId());
        long articleCount = articles.size();
        boolean onboardingDone = onboardingService.get(user).isCompleted();
        long followers = creatorFollowMapper.countFollowers(user.getId());
        CommunityProfile profile = profileMapper.findByUserId(user.getId());
        boolean hasBio = profile != null && profile.getBio() != null && !profile.getBio().isBlank();

        List<BadgeView> badges = new ArrayList<>();
        badges.add(new BadgeView("onboard", "入门完成", "完成入门引导", onboardingDone));
        badges.add(new BadgeView("first-post", "初次创作", "创建第一篇文章", articleCount >= 1));
        badges.add(new BadgeView("prolific", "勤耕不辍", "拥有 5 篇以上文章", articleCount >= 5));
        badges.add(new BadgeView("social", "社区之星", "粉丝达到 10", followers >= 10));
        badges.add(new BadgeView("profile", "名片完善", "填写个人简介", hasBio));
        return badges;
    }
}
