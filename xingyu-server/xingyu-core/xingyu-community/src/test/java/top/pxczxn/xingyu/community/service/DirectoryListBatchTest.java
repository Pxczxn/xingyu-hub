package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.Galaxy;
import top.pxczxn.xingyu.community.entity.GalaxyMember;
import top.pxczxn.xingyu.community.entity.GroupJoinRequest;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMemberMapper;
import top.pxczxn.xingyu.community.mapper.GroupJoinRequestMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DirectoryListBatchTest {

    private final ConversationMapper conversations = mock(ConversationMapper.class);
    private final GroupJoinRequestMapper requests = mock(GroupJoinRequestMapper.class);
    private final ConversationService conversationService = new ConversationService(
            conversations, null, null, null, null, requests, null, null, null, null);
    private final GalaxyMapper galaxies = mock(GalaxyMapper.class);
    private final GalaxyMemberMapper members = mock(GalaxyMemberMapper.class);
    private final GalaxyService galaxyService = new GalaxyService(
            galaxies, null, members, null, null, null, null, null, null, null, null);

    @Test
    void joinRequestsAndGalaxiesLoadOnce() {
        when(requests.listByUserId("me", 100)).thenReturn(List.of(
                request("r1", "group"),
                request("r2", "missing")));
        when(conversations.selectBatchIds(List.of("group", "missing"))).thenReturn(List.of(conversation("group", "写作组")));
        when(galaxies.listAll()).thenReturn(List.of(galaxy("g1", "火星"), galaxy("g2", "安静")));
        when(members.countByGalaxyIds(List.of("g1", "g2"))).thenReturn(List.of(new ObjectCountRow("g1", 4)));
        when(members.listByUserId("me")).thenReturn(List.of(membership("g2"), membership("gone")));
        when(galaxies.selectBatchIds(List.of("g2", "gone"))).thenReturn(List.of(galaxy("g2", "安静")));
        when(members.countByGalaxyIds(List.of("g2"))).thenReturn(List.of());

        var listedRequests = conversationService.listMyGroupJoinRequests(user("me"), 100);
        var listed = galaxyService.list();
        var mine = galaxyService.listMine(user("me"));

        assertThat(listedRequests).extracting(view -> view.conversationTitle()).containsExactly("写作组", null);
        assertThat(listedRequests).extracting(view -> view.joinMode()).containsExactly("OPEN", "OPEN");
        assertThat(listed).extracting("name").containsExactly("火星", "安静");
        assertThat(listed).extracting("memberCount").containsExactly(4L, 0L);
        assertThat(mine).extracting("name").containsExactly("安静");
        assertThat(mine).extracting("memberCount").containsExactly(0L);
        verify(conversations, never()).selectById(any());
        verify(galaxies, never()).selectById(any());
        verify(members, never()).countByGalaxyId(any());
    }

    @Test
    void emptyListsDoNotQueryDetails() {
        when(requests.listByUserId("me", 100)).thenReturn(List.of());
        when(galaxies.listAll()).thenReturn(List.of());
        when(members.listByUserId("me")).thenReturn(List.of());

        assertThat(conversationService.listMyGroupJoinRequests(user("me"), 100)).isEmpty();
        assertThat(galaxyService.list()).isEmpty();
        assertThat(galaxyService.listMine(user("me"))).isEmpty();

        verify(conversations, never()).selectBatchIds(any());
        verify(galaxies, never()).selectBatchIds(any());
        verify(members, never()).countByGalaxyIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static GroupJoinRequest request(String id, String conversationId) {
        GroupJoinRequest request = new GroupJoinRequest();
        request.setId(id);
        request.setConversationId(conversationId);
        return request;
    }

    private static Conversation conversation(String id, String title) {
        Conversation conversation = new Conversation();
        conversation.setId(id);
        conversation.setTitle(title);
        conversation.setJoinMode("OPEN");
        return conversation;
    }

    private static Galaxy galaxy(String id, String name) {
        Galaxy galaxy = new Galaxy();
        galaxy.setId(id);
        galaxy.setName(name);
        galaxy.setSlug(id);
        return galaxy;
    }

    private static GalaxyMember membership(String galaxyId) {
        GalaxyMember member = new GalaxyMember();
        member.setGalaxyId(galaxyId);
        member.setUserId("me");
        return member;
    }
}
