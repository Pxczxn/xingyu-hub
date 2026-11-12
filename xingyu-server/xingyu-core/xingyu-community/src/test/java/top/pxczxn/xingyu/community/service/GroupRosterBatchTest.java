package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.entity.GroupJoinRequest;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import top.pxczxn.xingyu.community.mapper.GroupJoinRequestMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GroupRosterBatchTest {

    private final ConversationMapper conversations = mock(ConversationMapper.class);
    private final ConversationMemberMapper members = mock(ConversationMemberMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final GroupJoinRequestMapper requests = mock(GroupJoinRequestMapper.class);
    private final ConversationService service = new ConversationService(
            conversations, members, null, null, profiles, requests, null, null, null, null);

    @Test
    void membersAndRequestsLoadProfilesOnce() {
        when(members.findByConversationAndUser("group", "owner")).thenReturn(member("owner", "OWNER"));
        when(conversations.selectById("group")).thenReturn(group());
        when(members.listByConversationId("group")).thenReturn(List.of(
                member("owner", "OWNER"),
                member("gone", "MEMBER")));
        when(profiles.findByUserIds(List.of("owner", "gone"))).thenReturn(List.of(profile("owner", "群主", "主人")));
        when(requests.listPending("group")).thenReturn(List.of(request("req-1", "guest")));
        when(profiles.findByUserIds(List.of("guest"))).thenReturn(List.of(profile("guest", "客人", "申请者")));

        var listedMembers = service.listMembers(user("owner"), "group");
        var listedRequests = service.listJoinRequests(user("owner"), "group");

        assertThat(listedMembers).extracting("username").containsExactly("群主", "gone");
        assertThat(listedMembers).extracting("displayName").containsExactly("主人", null);
        assertThat(listedMembers).extracting("role").containsExactly("OWNER", "MEMBER");
        assertThat(listedRequests).extracting(view -> view.username()).containsExactly("客人");
        assertThat(listedRequests).extracting(view -> view.displayName()).containsExactly("申请者");
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyRostersSkipProfilesAndASingleRequestStillLooksUpOnce() {
        when(members.findByConversationAndUser("group", "owner")).thenReturn(member("owner", "OWNER"));
        when(conversations.selectById("group")).thenReturn(group());
        when(members.listByConversationId("group")).thenReturn(List.of());
        when(requests.listPending("group")).thenReturn(List.of());
        when(members.findByConversationAndUser("group", "me")).thenReturn(null);
        when(profiles.findByUserId("me")).thenReturn(profile("me", "我", "自己"));

        assertThat(service.listMembers(user("owner"), "group")).isEmpty();
        assertThat(service.listJoinRequests(user("owner"), "group")).isEmpty();
        var submitted = service.submitJoinRequest(user("me"), "group", Map.of());

        assertThat(submitted.username()).isEqualTo("我");
        verify(profiles, never()).findByUserIds(any());
        verify(profiles).findByUserId("me");
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Conversation group() {
        Conversation conversation = new Conversation();
        conversation.setId("group");
        conversation.setType("GROUP");
        conversation.setJoinMode("OPEN");
        return conversation;
    }

    private static ConversationMember member(String userId, String role) {
        ConversationMember member = new ConversationMember();
        member.setUserId(userId);
        member.setRole(role);
        return member;
    }

    private static GroupJoinRequest request(String id, String userId) {
        GroupJoinRequest request = new GroupJoinRequest();
        request.setId(id);
        request.setConversationId("group");
        request.setUserId(userId);
        request.setStatus("PENDING");
        return request;
    }

    private static CommunityProfile profile(String userId, String username, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }
}
