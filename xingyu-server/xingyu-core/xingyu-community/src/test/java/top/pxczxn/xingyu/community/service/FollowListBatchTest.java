package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UserFollow;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FollowListBatchTest {

    private final UserFollowMapper follows = mock(UserFollowMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final SocialService service = new SocialService(
            null, follows, null, null, null, profiles, null, null, null, null, null, null);

    @Test
    void followingAndFollowersLoadProfilesAndTimesTogether() {
        Instant followedAt = Instant.parse("2026-10-30T00:00:00Z");
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of("a", "gone"));
        when(profiles.findByUserIds(List.of("a", "gone"))).thenReturn(List.of(profile("a", "甲")));
        when(follows.listByFollowerAndFollowees("me", List.of("a"))).thenReturn(List.of(follow("me", "a", followedAt)));
        when(profiles.findByUserId("owner")).thenReturn(profile("owner", "主人"));
        when(follows.listFollowerIdsByFollowee("owner", 20)).thenReturn(List.of("b", "missing"));
        when(profiles.findByUserIds(List.of("b", "missing"))).thenReturn(List.of(profile("b", "乙")));
        when(follows.listByFolloweeAndFollowers("owner", List.of("b"))).thenReturn(List.of());
        when(follows.countFollowers("owner")).thenReturn(4L);

        var following = service.listFollowing(user("me"), 0);
        var followers = service.listFollowers(user("owner"), 0);

        assertThat(following.getItems()).extracting("userId").containsExactly("a");
        assertThat(following.getItems()).extracting("displayName").containsExactly("甲");
        assertThat(following.getItems()).extracting("followedAt").containsExactly(followedAt);
        assertThat(following.getTotal()).isEqualTo(1L);
        assertThat(followers.getItems()).extracting("userId").containsExactly("b");
        assertThat(followers.getItems().get(0).getFollowedAt()).isNull();
        assertThat(followers.getTotal()).isEqualTo(4L);
        verify(profiles, never()).findByUserId("a");
        verify(profiles, never()).findByUserId("b");
        verify(follows, never()).findByFollowerAndFollowee(any(), any());
    }

    @Test
    void emptyFollowListsDoNotQueryProfiles() {
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        when(profiles.findByUserId("owner")).thenReturn(profile("owner", "主人"));
        when(follows.listFollowerIdsByFollowee("owner", 20)).thenReturn(List.of());
        when(follows.countFollowers("owner")).thenReturn(0L);

        assertThat(service.listFollowing(user("me"), 20).getItems()).isEmpty();
        assertThat(service.listFollowers(user("owner"), 20).getItems()).isEmpty();

        verify(profiles, never()).findByUserIds(any());
        verify(follows, never()).listByFollowerAndFollowees(any(), any());
        verify(follows, never()).listByFolloweeAndFollowers(any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static CommunityProfile profile(String userId, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(userId);
        profile.setDisplayName(displayName);
        return profile;
    }

    private static UserFollow follow(String followerId, String followeeId, Instant createdAt) {
        UserFollow follow = new UserFollow();
        follow.setFollowerId(followerId);
        follow.setFolloweeId(followeeId);
        follow.setCreatedAt(createdAt);
        return follow;
    }
}
