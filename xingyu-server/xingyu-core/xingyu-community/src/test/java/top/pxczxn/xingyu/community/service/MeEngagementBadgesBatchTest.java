package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.OnboardingView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeEngagementBadgesBatchTest {

    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final UserFollowMapper follows = mock(UserFollowMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final OnboardingService onboarding = mock(OnboardingService.class);
    private final MeEngagementService service = new MeEngagementService(
            articles, follows, null, null, profiles, onboarding);

    @Test
    void badgesCountEveryOwnedArticleOnceWithoutListingRows() {
        when(articles.countByOwnerId("me")).thenReturn(5L);
        when(follows.countFollowers("me")).thenReturn(10L);
        when(onboarding.get(any())).thenReturn(OnboardingView.builder().completed(true).build());
        CommunityProfile profile = new CommunityProfile();
        profile.setBio("hello");
        when(profiles.findByUserId("me")).thenReturn(profile);

        var badges = service.badges(user("me"));

        assertThat(badges).extracting(badge -> badge.id()).containsExactly(
                "onboard", "first-post", "prolific", "social", "profile");
        assertThat(badges).extracting(badge -> badge.earned()).containsExactly(
                true, true, true, true, true);
        verify(articles).countByOwnerId("me");
        verify(articles, never()).listByOwnerId(any());
        verify(articles, never()).countByOwnerAndStatus(any(), any());
    }

    @Test
    void firstPostAndProlificStayUnearnedBelowTheTotalCount() {
        when(articles.countByOwnerId("me")).thenReturn(1L);
        when(follows.countFollowers("me")).thenReturn(0L);
        when(onboarding.get(any())).thenReturn(OnboardingView.builder().completed(false).build());
        when(profiles.findByUserId("me")).thenReturn(null);

        var badges = service.badges(user("me"));

        assertThat(badges).filteredOn(badge -> "first-post".equals(badge.id()))
                .extracting(badge -> badge.earned())
                .containsExactly(true);
        assertThat(badges).filteredOn(badge -> "prolific".equals(badge.id()))
                .extracting(badge -> badge.earned())
                .containsExactly(false);
        verify(articles, never()).listByOwnerId(any());
        verify(articles, never()).countByOwnerAndStatus(any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }
}
