package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.SavedMessageView;
import top.pxczxn.xingyu.community.entity.ChatMessage;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.entity.SavedMessage;
import top.pxczxn.xingyu.community.mapper.ChatMessageMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import top.pxczxn.xingyu.community.mapper.SavedMessageMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SavedMessageService {

    private final SavedMessageMapper savedMessageMapper;
    private final ChatMessageMapper messageMapper;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberMapper memberMapper;

    public List<SavedMessageView> listSaved(CommunityUser user, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        return savedMessageMapper.listByUserId(user.getId(), capped).stream()
                .map(saved -> toView(saved))
                .toList();
    }

    @Transactional
    public SavedMessageView saveMessage(CommunityUser user, String messageId) {
        String resolvedMessageId = trimToNull(messageId);
        if (resolvedMessageId == null) {
            throw new FieldContractException("messageId", "消息标识不能为空");
        }
        ChatMessage message = messageMapper.findById(resolvedMessageId);
        if (message == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        requireMember(user, message.getConversationId());
        SavedMessage existing = savedMessageMapper.findByUserAndMessage(user.getId(), resolvedMessageId);
        if (existing != null) {
            return toView(existing);
        }
        Instant now = Instant.now();
        SavedMessage saved = new SavedMessage();
        saved.setId(TokenSupport.newId());
        saved.setUserId(user.getId());
        saved.setMessageId(resolvedMessageId);
        saved.setConversationId(message.getConversationId());
        saved.setCreatedAt(now);
        savedMessageMapper.insert(saved);
        return toView(saved);
    }

    @Transactional
    public void removeSaved(CommunityUser user, String messageId) {
        SavedMessage saved = savedMessageMapper.findByUserAndMessage(user.getId(), messageId);
        if (saved == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        savedMessageMapper.deleteById(saved.getId());
    }

    private SavedMessageView toView(SavedMessage saved) {
        ChatMessage message = messageMapper.findById(saved.getMessageId());
        Conversation conversation = conversationMapper.selectById(saved.getConversationId());
        if (message == null || conversation == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return new SavedMessageView(
                saved.getId(),
                saved.getMessageId(),
                saved.getConversationId(),
                conversation.getType(),
                conversation.getTitle(),
                message.getMessageType() == null ? "TEXT" : message.getMessageType(),
                message.getBody(),
                message.getAttachmentUrl(),
                message.getAttachmentName(),
                message.getSenderId(),
                message.getCreatedAt(),
                saved.getCreatedAt());
    }

    private void requireMember(CommunityUser user, String conversationId) {
        ConversationMember member = memberMapper.findByConversationAndUser(conversationId, user.getId());
        if (member == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
