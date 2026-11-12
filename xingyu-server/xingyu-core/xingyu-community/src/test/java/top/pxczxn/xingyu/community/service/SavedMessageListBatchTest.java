package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.entity.ChatMessage;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.entity.SavedMessage;
import top.pxczxn.xingyu.community.mapper.ChatMessageMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import top.pxczxn.xingyu.community.mapper.SavedMessageMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SavedMessageListBatchTest {

    private final SavedMessageMapper savedMessages = mock(SavedMessageMapper.class);
    private final ChatMessageMapper messages = mock(ChatMessageMapper.class);
    private final ConversationMapper conversations = mock(ConversationMapper.class);
    private final ConversationMemberMapper members = mock(ConversationMemberMapper.class);
    private final SavedMessageService service = new SavedMessageService(
            savedMessages, messages, conversations, members);

    @Test
    void savedListLoadsMessagesAndConversationsOnce() {
        Instant savedAt = Instant.parse("2026-10-02T00:00:00Z");
        when(savedMessages.listByUserId("me", 1)).thenReturn(List.of(
                saved("s1", "m1", "c1", savedAt),
                saved("s2", "m2", "c2", savedAt.plusSeconds(1))));
        when(messages.selectBatchIds(List.of("m1", "m2"))).thenReturn(List.of(
                message("m1", "第一条"),
                message("m2", "第二条")));
        when(conversations.selectBatchIds(List.of("c1", "c2"))).thenReturn(List.of(
                conversation("c1", "DIRECT", "私信"),
                conversation("c2", "GROUP", "群")));

        var listed = service.listSaved(user("me"), 0);

        assertThat(listed).extracting(view -> view.body()).containsExactly("第一条", "第二条");
        assertThat(listed).extracting(view -> view.conversationType()).containsExactly("DIRECT", "GROUP");
        assertThat(listed).extracting(view -> view.conversationTitle()).containsExactly("私信", "群");
        assertThat(listed).extracting(view -> view.savedAt()).containsExactly(savedAt, savedAt.plusSeconds(1));
        verify(messages, never()).findById(any());
        verify(conversations, never()).selectById(any());
    }

    @Test
    void missingConversationStaysNotFoundAndEmptyListSkipsBatchReads() {
        when(savedMessages.listByUserId("me", 1)).thenReturn(List.of(saved("s1", "m1", "c1", Instant.EPOCH)));
        when(messages.selectBatchIds(List.of("m1"))).thenReturn(List.of(message("m1", "正文")));
        when(conversations.selectBatchIds(List.of("c1"))).thenReturn(List.of());

        assertThatThrownBy(() -> service.listSaved(user("me"), 0))
                .isInstanceOf(ContractException.class)
                .extracting(error -> ((ContractException) error).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);

        clearInvocations(messages, conversations);
        when(savedMessages.listByUserId("me", 1)).thenReturn(List.of());
        assertThat(service.listSaved(user("me"), 0)).isEmpty();
        verify(messages, never()).selectBatchIds(any());
        verify(conversations, never()).selectBatchIds(any());
        verify(messages, never()).findById(any());
        verify(conversations, never()).selectById(any());
    }

    @Test
    void savingAnExistingMessageStillUsesSingleLookups() {
        when(messages.findById("m1")).thenReturn(message("m1", "正文"));
        when(members.findByConversationAndUser("c1", "me")).thenReturn(new ConversationMember());
        when(savedMessages.findByUserAndMessage("me", "m1")).thenReturn(saved("s1", "m1", "c1", Instant.EPOCH));
        when(conversations.selectById("c1")).thenReturn(conversation("c1", "DIRECT", "私信"));

        var saved = service.saveMessage(user("me"), "m1");

        assertThat(saved.body()).isEqualTo("正文");
        assertThat(saved.conversationTitle()).isEqualTo("私信");
        verify(messages, never()).selectBatchIds(any());
        verify(conversations, never()).selectBatchIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static SavedMessage saved(String id, String messageId, String conversationId, Instant savedAt) {
        SavedMessage saved = new SavedMessage();
        saved.setId(id);
        saved.setMessageId(messageId);
        saved.setConversationId(conversationId);
        saved.setCreatedAt(savedAt);
        return saved;
    }

    private static ChatMessage message(String id, String body) {
        ChatMessage message = new ChatMessage();
        message.setId(id);
        message.setConversationId("c1");
        message.setBody(body);
        message.setMessageType("TEXT");
        message.setSenderId("other");
        message.setCreatedAt(Instant.EPOCH);
        return message;
    }

    private static Conversation conversation(String id, String type, String title) {
        Conversation conversation = new Conversation();
        conversation.setId(id);
        conversation.setType(type);
        conversation.setTitle(title);
        return conversation;
    }
}
