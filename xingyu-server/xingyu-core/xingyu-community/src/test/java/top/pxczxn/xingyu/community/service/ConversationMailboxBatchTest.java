package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
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

class ConversationMailboxBatchTest {

    private final ConversationMapper conversations = mock(ConversationMapper.class);
    private final ConversationMemberMapper members = mock(ConversationMemberMapper.class);
    private final ChatMessageMapper messages = mock(ChatMessageMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final ConversationService service = new ConversationService(
            conversations, members, messages, null, profiles, null, null, null, null, null);

    @Test
    void mailboxLoadsPreviewUnreadAndNamesInOneBatch() {
        when(conversations.listByUserId("me")).thenReturn(List.of(
                conversation("direct", "DIRECT", null),
                conversation("silent", "DIRECT", null),
                conversation("group", "GROUP", "写作组")));
        when(members.listByConversationIds(List.of("direct", "silent", "group"))).thenReturn(List.of(
                member("direct", "me", "MEMBER"),
                member("direct", "other", "MEMBER"),
                member("silent", "me", "MEMBER"),
                member("silent", "ghost", "MEMBER"),
                member("group", "me", "OWNER")));
        when(messages.listLastByConversationIds(List.of("direct", "silent", "group"))).thenReturn(List.of(
                message("direct", "你好"),
                message("group", "集合")));
        when(messages.countUnreadByConversationIds("me", List.of("direct", "silent", "group")))
                .thenReturn(List.of(new ObjectCountRow("direct", 2)));
        when(profiles.findByUserIds(List.of("other", "ghost"))).thenReturn(List.of(profile("other", "对方")));

        var listed = service.listConversations(user("me"));

        assertThat(listed).extracting("id").containsExactly("direct", "silent", "group");
        assertThat(listed).extracting("lastMessage").containsExactly("你好", null, "集合");
        assertThat(listed).extracting("unreadCount").containsExactly(2L, 0L, 0L);
        assertThat(listed).extracting("myRole").containsExactly("MEMBER", "MEMBER", "OWNER");
        assertThat(listed).extracting("counterpartDisplayName").containsExactly("对方", null, null);
        assertThat(listed.get(2).getTitle()).isEqualTo("写作组");
        verify(members, never()).findByConversationAndUser(any(), any());
        verify(members, never()).listByConversationId(any());
        verify(messages, never()).findLastByConversationId(any());
        verify(messages, never()).countUnread(any(), any());
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyMailboxDoesNotQueryDetails() {
        when(conversations.listByUserId("me")).thenReturn(List.of());

        assertThat(service.listConversations(user("me"))).isEmpty();

        verify(members, never()).listByConversationIds(any());
        verify(messages, never()).listLastByConversationIds(any());
        verify(profiles, never()).findByUserIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Conversation conversation(String id, String type, String title) {
        Conversation conversation = new Conversation();
        conversation.setId(id);
        conversation.setType(type);
        conversation.setTitle(title);
        return conversation;
    }

    private static ConversationMember member(String conversationId, String userId, String role) {
        ConversationMember member = new ConversationMember();
        member.setConversationId(conversationId);
        member.setUserId(userId);
        member.setRole(role);
        return member;
    }

    private static ChatMessage message(String conversationId, String body) {
        ChatMessage message = new ChatMessage();
        message.setConversationId(conversationId);
        message.setBody(body);
        message.setMessageType("TEXT");
        return message;
    }

    private static CommunityProfile profile(String userId, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(userId);
        profile.setDisplayName(displayName);
        return profile;
    }
}
