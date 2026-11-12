package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UserBlock;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.UserBlockMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BlockedUserListBatchTest {

    private final UserBlockMapper blocks = mock(UserBlockMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final UserBlockService service = new UserBlockService(blocks, profiles, null);

    @Test
    void blockedListLoadsProfilesOnce() {
        when(blocks.listByBlocker("me", 50)).thenReturn(List.of(block("other"), block("gone")));
        when(profiles.findByUserIds(List.of("other", "gone"))).thenReturn(List.of(profile("other", "对方", "名字")));

        var listed = service.listBlocked(user("me"), 0);

        assertThat(listed).extracting("username").containsExactly("对方", "gone");
        assertThat(listed).extracting("displayName").containsExactly("名字", null);
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyBlockListDoesNotQueryProfiles() {
        when(blocks.listByBlocker("me", 50)).thenReturn(List.of());

        assertThat(service.listBlocked(user("me"), 50)).isEmpty();

        verify(profiles, never()).findByUserIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static UserBlock block(String blockedId) {
        UserBlock block = new UserBlock();
        block.setBlockedId(blockedId);
        return block;
    }

    private static CommunityProfile profile(String userId, String username, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }
}
