package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.ChatMessage;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.mapper.ChatMessageMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MessageSearchBatchTest {

    private final ConversationMapper conversations = mock(ConversationMapper.class);
    private final ConversationMemberMapper members = mock(ConversationMemberMapper.class);
    private final ChatMessageMapper messages = mock(ChatMessageMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final ConversationService service = new ConversationService(
            conversations, members, messages, null, profiles, null, null, null, null, null);

    @Test
    void searchLoadsConversationsMembersAndNamesOnce() {
        when(messages.searchForUser("me", "星", 1)).thenReturn(List.of(
                hit("direct", "第一条"),
                hit("direct", "第二条"),
                hit("group", "群里"),
                hit("gone", "丢了"),
                hit("quiet", "没资料")));
        when(conversations.selectBatchIds(List.of("direct", "group", "gone", "quiet"))).thenReturn(List.of(
                conversation("direct", "DIRECT"),
                conversation("group", "GROUP"),
                conversation("quiet", "DIRECT")));
        when(members.listByConversationIds(List.of("direct", "quiet"))).thenReturn(List.of(
                member("direct", "me"),
                member("direct", "other"),
                member("quiet", "me"),
                member("quiet", "ghost")));
        when(profiles.findByUserIds(List.of("other", "ghost")))
                .thenReturn(List.of(profile("other", "对方")));

        var listed = service.searchMessages(user("me"), "星", 0);

        assertThat(listed).extracting("conversationType")
                .containsExactly("DIRECT", "DIRECT", "GROUP", null, "DIRECT");
        assertThat(listed).extracting("counterpartDisplayName")
                .containsExactly("对方", "对方", null, null, null);
        verify(conversations, never()).selectById(any());
        verify(members, never()).listByConversationId(any());
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void blankQueryAndEmptyHitsSkipConversationReads() {
        assertThat(service.searchMessages(user("me"), "  ", 20)).isEmpty();
        when(messages.searchForUser("me", "没有", 1)).thenReturn(List.of());
        assertThat(service.searchMessages(user("me"), "没有", 0)).isEmpty();

        verify(conversations, never()).selectBatchIds(any());
        verify(conversations, never()).selectById(any());
        verify(members, never()).listByConversationIds(any());
        verify(profiles, never()).findByUserIds(any());
    }

    @Test
    void singleConversationStillLooksUpItsOwnMemberAndProfile() {
        Conversation direct = conversation("direct", "DIRECT");
        when(members.listByConversationId("direct")).thenReturn(List.of(
                member("direct", "me"),
                member("direct", "other")));
        when(profiles.findByUserId("other")).thenReturn(profile("other", "对方"));

        assertThat(service.resolveCounterpartDisplayName(direct, "me")).isEqualTo("对方");

        verify(members, never()).listByConversationIds(any());
        verify(profiles, never()).findByUserIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static ChatMessage hit(String conversationId, String body) {
        ChatMessage message = new ChatMessage();
        message.setConversationId(conversationId);
        message.setBody(body);
        message.setMessageType("TEXT");
        return message;
    }

    private static Conversation conversation(String id, String type) {
        Conversation conversation = new Conversation();
        conversation.setId(id);
        conversation.setType(type);
        return conversation;
    }

    private static ConversationMember member(String conversationId, String userId) {
        ConversationMember member = new ConversationMember();
        member.setConversationId(conversationId);
        member.setUserId(userId);
        return member;
    }

    private static CommunityProfile profile(String userId, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(userId);
        profile.setDisplayName(displayName);
        return profile;
    }
}
