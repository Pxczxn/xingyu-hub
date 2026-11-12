package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.Galaxy;
import top.pxczxn.xingyu.community.entity.GalaxyMember;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMemberMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GalaxyMemberListBatchTest {

    private final GalaxyMapper galaxies = mock(GalaxyMapper.class);
    private final GalaxyMemberMapper members = mock(GalaxyMemberMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final GalaxyService service = new GalaxyService(
            galaxies, null, members, null, null, null, null, profiles, null, null, null);

    @Test
    void memberListLoadsProfilesOnceAndKeepsOrder() {
        Instant joined = Instant.parse("2026-10-01T00:00:00Z");
        when(galaxies.findBySlug("orion")).thenReturn(galaxy());
        when(members.listByGalaxyId("galaxy-1", 50)).thenReturn(List.of(
                member("owner", "OWNER", joined),
                member("gone", "MEMBER", joined.plusSeconds(1))));
        when(profiles.findByUserIds(List.of("owner", "gone")))
                .thenReturn(List.of(profile("owner", "群主", "主人")));

        var listed = service.listMembers("orion", 0);

        assertThat(listed).extracting("username").containsExactly("群主", "gone");
        assertThat(listed).extracting("displayName").containsExactly("主人", null);
        assertThat(listed).extracting("role").containsExactly("OWNER", "MEMBER");
        assertThat(listed).extracting("joinedAt").containsExactly(joined, joined.plusSeconds(1));
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyMemberListSkipsProfiles() {
        when(galaxies.findBySlug("orion")).thenReturn(galaxy());
        when(members.listByGalaxyId("galaxy-1", 50)).thenReturn(List.of());

        assertThat(service.listMembers("orion", 0)).isEmpty();

        verify(profiles, never()).findByUserIds(any());
        verify(profiles, never()).findByUserId(any());
    }

    private static Galaxy galaxy() {
        Galaxy galaxy = new Galaxy();
        galaxy.setId("galaxy-1");
        galaxy.setSlug("orion");
        return galaxy;
    }

    private static GalaxyMember member(String userId, String role, Instant joinedAt) {
        GalaxyMember member = new GalaxyMember();
        member.setUserId(userId);
        member.setRole(role);
        member.setJoinedAt(joinedAt);
        return member;
    }

    private static CommunityProfile profile(String userId, String username, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }
}
