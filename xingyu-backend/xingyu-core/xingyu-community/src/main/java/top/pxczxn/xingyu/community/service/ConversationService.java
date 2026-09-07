package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.dto.ChatMessageView;
import top.pxczxn.xingyu.community.dto.ConversationMemberView;
import top.pxczxn.xingyu.community.dto.ConversationView;
import top.pxczxn.xingyu.community.dto.GroupJoinRequestView;
import top.pxczxn.xingyu.community.dto.MyGroupJoinRequestView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.ChatMessage;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.entity.GroupJoinRequest;
import top.pxczxn.xingyu.community.mapper.ChatMessageMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import top.pxczxn.xingyu.community.mapper.GroupJoinRequestMapper;
import top.pxczxn.xingyu.community.event.ChatMessageSentEvent;
import top.pxczxn.xingyu.community.event.CommunityChatRealtimeEvent;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final String JOIN_OPEN = "OPEN";
    private static final String JOIN_APPROVAL = "APPROVAL";
    private static final int MAX_ANNOUNCEMENT_LENGTH = 2000;
    private static final String MSG_TEXT = "TEXT";
    private static final String MSG_IMAGE = "IMAGE";
    private static final String MSG_FILE = "FILE";

    private final ConversationMapper conversationMapper;
    private final ConversationMemberMapper memberMapper;
    private final ChatMessageMapper messageMapper;
    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
    private final GroupJoinRequestMapper joinRequestMapper;
    private final UserBlockService userBlockService;
    private final CommunityProperties communityProperties;
    private final ApplicationEventPublisher eventPublisher;

    public List<ConversationView> listConversations(CommunityUser user) {
        return conversationMapper.listByUserId(user.getId()).stream()
                .map(c -> buildConversationView(c, user.getId(), List.of()))
                .toList();
    }

    public ConversationView getDirectConversation(CommunityUser user, String conversationId) {
        requireMember(user, conversationId);
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null || !"DIRECT".equals(conversation.getType())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        List<ChatMessageView> messages = listMessages(user, conversationId, null, 100).getItems();
        return buildConversationView(conversation, user.getId(), messages);
    }

    public ConversationView getGroupConversation(CommunityUser user, String conversationId) {
        requireMember(user, conversationId);
        Conversation conversation = requireGroup(conversationId);
        List<ChatMessageView> messages = listMessages(user, conversationId, null, 100).getItems();
        return buildConversationView(conversation, user.getId(), messages);
    }

    public PageResultView<ChatMessageView> listMessages(
            CommunityUser user,
            String conversationId,
            String cursor,
            int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        Long beforeSequence = parseCursor(cursor);
        List<ChatMessage> raw = messageMapper.listPageBeforeSequence(conversationId, beforeSequence, capped);
        List<ChatMessage> ordered = new ArrayList<>(raw);
        Collections.reverse(ordered);
        List<ChatMessageView> items = ordered.stream().map(this::toMessageView).toList();
        String nextCursor = items.isEmpty() ? null : String.valueOf(items.get(0).getSequenceNumber());
        return PageResultView.<ChatMessageView>builder()
                .items(items)
                .nextCursor(nextCursor)
                .total((long) items.size())
                .build();
    }

    @Transactional
    public void markConversationRead(CommunityUser user, String conversationId, Map<String, String> body) {
        ConversationMember member = requireMember(user, conversationId);
        long sequence;
        if (body != null && body.containsKey("sequenceNumber")) {
            sequence = parseSequence(body.get("sequenceNumber"));
        } else {
            ChatMessage last = messageMapper.findLastByConversationId(conversationId);
            sequence = last == null || last.getSequenceNumber() == null ? 0L : last.getSequenceNumber();
        }
        Long current = member.getLastReadSequence() == null ? 0L : member.getLastReadSequence();
        if (sequence > current) {
            member.setLastReadSequence(sequence);
            memberMapper.updateById(member);
            eventPublisher.publishEvent(new CommunityChatRealtimeEvent(
                    conversationId,
                    "read",
                    Map.of(
                            "userId", user.getId(),
                            "sequenceNumber", sequence)));
        }
    }

    @Transactional
    public ChatMessageView recallMessage(CommunityUser user, String conversationId, String messageId) {
        requireMember(user, conversationId);
        ChatMessage message = messageMapper.findById(messageId);
        if (message == null || !conversationId.equals(message.getConversationId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!user.getId().equals(message.getSenderId())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN);
        }
        if (message.getRecalledAt() != null) {
            return toMessageView(message);
        }
        long elapsed = Instant.now().getEpochSecond() - message.getCreatedAt().getEpochSecond();
        if (elapsed > communityProperties.getMessageRecallWindowSeconds()) {
            throw new ContractException(ErrorCode.CONFLICT, "已超过可撤回时间窗口");
        }
        message.setRecalledAt(Instant.now());
        messageMapper.updateById(message);
        ChatMessageView view = toMessageView(message);
        eventPublisher.publishEvent(new CommunityChatRealtimeEvent(
                conversationId,
                "recall",
                Map.of("message", view)));
        return view;
    }

    public List<ChatMessageView> listMediaMessages(CommunityUser user, String conversationId, int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        return messageMapper.listByConversationIdAndType(conversationId, MSG_IMAGE, capped).stream()
                .map(this::toMessageView)
                .toList();
    }

    public List<ChatMessageView> listFileMessages(CommunityUser user, String conversationId, int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        return messageMapper.listByConversationIdAndType(conversationId, MSG_FILE, capped).stream()
                .map(this::toMessageView)
                .toList();
    }

    public List<MyGroupJoinRequestView> listMyGroupJoinRequests(CommunityUser user, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        return joinRequestMapper.listByUserId(user.getId(), capped).stream()
                .map(request -> {
                    Conversation conversation = conversationMapper.selectById(request.getConversationId());
                    return new MyGroupJoinRequestView(
                            request.getId(),
                            request.getConversationId(),
                            conversation == null ? null : conversation.getTitle(),
                            conversation == null ? JOIN_OPEN : conversation.getJoinMode(),
                            request.getMessage(),
                            request.getStatus(),
                            request.getCreatedAt(),
                            request.getResolvedAt());
                })
                .toList();
    }

    public List<ChatMessageView> searchMessages(CommunityUser user, String query, int limit) {
        String trimmed = trimToNull(query);
        if (trimmed == null) {
            return List.of();
        }
        int capped = Math.min(Math.max(limit, 1), 100);
        return messageMapper.searchForUser(user.getId(), trimmed, capped).stream()
                .map(message -> {
                    Conversation conversation = conversationMapper.selectById(message.getConversationId());
                    String type = conversation == null ? null : conversation.getType();
                    return toMessageView(message, type);
                })
                .toList();
    }

    @Transactional
    public void leaveGroup(CommunityUser user, String conversationId) {
        ConversationMember member = requireMember(user, conversationId);
        if ("OWNER".equals(member.getRole())) {
            throw new ContractException(ErrorCode.CONFLICT, "群主请先转让群主或解散群聊");
        }
        memberMapper.deleteById(member.getId());
    }

    @Transactional
    public void removeMember(CommunityUser user, String conversationId, String targetUserId) {
        requireOwnerOrAdmin(user, conversationId);
        ConversationMember target = memberMapper.findByConversationAndUser(conversationId, targetUserId);
        if (target == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if ("OWNER".equals(target.getRole())) {
            throw new ContractException(ErrorCode.CONFLICT, "不能移除群主");
        }
        memberMapper.deleteById(target.getId());
    }

    @Transactional
    public ConversationView createGroup(CommunityUser user, Map<String, String> body) {
        String title = trimToNull(body.get("title"));
        if (title == null) {
            throw new FieldContractException("title", "群聊标题不能为空");
        }
        Instant now = Instant.now();
        Conversation conversation = new Conversation();
        conversation.setId(TokenSupport.newId());
        conversation.setType("GROUP");
        conversation.setTitle(title);
        conversation.setJoinMode(JOIN_OPEN);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversationMapper.insert(conversation);
        insertMember(conversation.getId(), user.getId(), "OWNER", now);
        return buildConversationView(conversation, user.getId(), List.of());
    }

    @Transactional
    public ConversationView updateGroupAnnouncement(
            CommunityUser user,
            String conversationId,
            Map<String, String> body) {
        ConversationMember member = requireOwnerOrAdmin(user, conversationId);
        Conversation conversation = requireGroup(conversationId);
        String announcement = body.get("announcement");
        if (announcement != null && announcement.length() > MAX_ANNOUNCEMENT_LENGTH) {
            throw new FieldContractException("announcement", "群公告不能超过 2000 字");
        }
        Instant now = Instant.now();
        conversation.setAnnouncement(trimToNull(announcement));
        conversation.setAnnouncementUpdatedAt(conversation.getAnnouncement() == null ? null : now);
        conversation.setUpdatedAt(now);
        conversationMapper.updateById(conversation);
        return buildConversationView(conversation, member.getUserId(), List.of());
    }

    @Transactional
    public ConversationView updateGroupSettings(
            CommunityUser user,
            String conversationId,
            Map<String, String> body) {
        ConversationMember member = requireOwnerOrAdmin(user, conversationId);
        Conversation conversation = requireGroup(conversationId);
        Instant now = Instant.now();
        if (body.containsKey("title")) {
            String title = trimToNull(body.get("title"));
            if (title == null) {
                throw new FieldContractException("title", "群聊标题不能为空");
            }
            conversation.setTitle(title);
        }
        if (body.containsKey("joinMode")) {
            String joinMode = parseJoinMode(body.get("joinMode"));
            if (!"OWNER".equals(member.getRole())) {
                throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "仅群主可修改入群模式");
            }
            conversation.setJoinMode(joinMode);
        }
        conversation.setUpdatedAt(now);
        conversationMapper.updateById(conversation);
        return buildConversationView(conversation, member.getUserId(), List.of());
    }

    public List<GroupJoinRequestView> listJoinRequests(CommunityUser user, String conversationId) {
        requireOwnerOrAdmin(user, conversationId);
        requireGroup(conversationId);
        return joinRequestMapper.listPending(conversationId).stream()
                .map(this::toJoinRequestView)
                .toList();
    }

    @Transactional
    public GroupJoinRequestView submitJoinRequest(
            CommunityUser user,
            String conversationId,
            Map<String, String> body) {
        Conversation conversation = requireGroup(conversationId);
        ConversationMember existing = memberMapper.findByConversationAndUser(conversationId, user.getId());
        if (existing != null) {
            throw new ContractException(ErrorCode.CONFLICT, "你已是群成员");
        }
        String joinMode = conversation.getJoinMode() == null ? JOIN_OPEN : conversation.getJoinMode();
        String message = trimToNull(body.get("message"));
        if (message != null && message.length() > 512) {
            throw new FieldContractException("message", "申请附言不能超过 512 字");
        }
        if (JOIN_OPEN.equals(joinMode)) {
            Instant now = Instant.now();
            insertMember(conversationId, user.getId(), "MEMBER", now);
            conversation.setUpdatedAt(now);
            conversationMapper.updateById(conversation);
            GroupJoinRequest request = new GroupJoinRequest();
            request.setId(TokenSupport.newId());
            request.setConversationId(conversationId);
            request.setUserId(user.getId());
            request.setMessage(message);
            request.setStatus("APPROVED");
            request.setCreatedAt(now);
            request.setResolvedAt(now);
            request.setResolvedBy(user.getId());
            joinRequestMapper.insert(request);
            return toJoinRequestView(request);
        }
        GroupJoinRequest pending = joinRequestMapper.findPending(conversationId, user.getId());
        if (pending != null) {
            throw new ContractException(ErrorCode.CONFLICT, "已有待处理的入群申请");
        }
        Instant now = Instant.now();
        GroupJoinRequest request = new GroupJoinRequest();
        request.setId(TokenSupport.newId());
        request.setConversationId(conversationId);
        request.setUserId(user.getId());
        request.setMessage(message);
        request.setStatus("PENDING");
        request.setCreatedAt(now);
        joinRequestMapper.insert(request);
        return toJoinRequestView(request);
    }

    @Transactional
    public void approveJoinRequest(CommunityUser user, String conversationId, String requestId) {
        ConversationMember resolver = requireOwnerOrAdmin(user, conversationId);
        requireGroup(conversationId);
        GroupJoinRequest request = joinRequestMapper.selectById(requestId);
        if (request == null
                || !conversationId.equals(request.getConversationId())
                || !"PENDING".equals(request.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Instant now = Instant.now();
        ConversationMember existing = memberMapper.findByConversationAndUser(conversationId, request.getUserId());
        if (existing == null) {
            insertMember(conversationId, request.getUserId(), "MEMBER", now);
        }
        request.setStatus("APPROVED");
        request.setResolvedAt(now);
        request.setResolvedBy(resolver.getUserId());
        joinRequestMapper.updateById(request);
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation != null) {
            conversation.setUpdatedAt(now);
            conversationMapper.updateById(conversation);
        }
    }

    @Transactional
    public void rejectJoinRequest(CommunityUser user, String conversationId, String requestId) {
        ConversationMember resolver = requireOwnerOrAdmin(user, conversationId);
        requireGroup(conversationId);
        GroupJoinRequest request = joinRequestMapper.selectById(requestId);
        if (request == null
                || !conversationId.equals(request.getConversationId())
                || !"PENDING".equals(request.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Instant now = Instant.now();
        request.setStatus("REJECTED");
        request.setResolvedAt(now);
        request.setResolvedBy(resolver.getUserId());
        joinRequestMapper.updateById(request);
    }

    public List<ConversationMemberView> listMembers(CommunityUser user, String conversationId) {
        requireMember(user, conversationId);
        return memberMapper.listByConversationId(conversationId).stream()
                .map(member -> {
                    CommunityProfile profile = profileMapper.findByUserId(member.getUserId());
                    return ConversationMemberView.builder()
                            .userId(member.getUserId())
                            .username(profile == null ? member.getUserId() : profile.getUsername())
                            .displayName(profile == null ? null : profile.getDisplayName())
                            .role(member.getRole())
                            .build();
                })
                .toList();
    }

    @Transactional
    public ConversationView openDirect(CommunityUser user, String otherUserId) {
        String resolvedUserId = resolveUserId(otherUserId);
        if (user.getId().equals(resolvedUserId)) {
            throw new FieldContractException("userId", "不能与自己发起私信");
        }
        if (userBlockService.isBlockedEitherWay(user.getId(), resolvedUserId)) {
            throw new ContractException(ErrorCode.CONFLICT, "无法向该用户发送私信");
        }
        if (userMapper.selectById(resolvedUserId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        String existingId = memberMapper.findDirectConversationId(user.getId(), resolvedUserId);
        if (existingId != null) {
            return getDirectConversation(user, existingId);
        }
        Instant now = Instant.now();
        Conversation conversation = new Conversation();
        conversation.setId(TokenSupport.newId());
        conversation.setType("DIRECT");
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversationMapper.insert(conversation);
        insertMember(conversation.getId(), user.getId(), "MEMBER", now);
        insertMember(conversation.getId(), resolvedUserId, "MEMBER", now);
        return buildConversationView(conversation, user.getId(), List.of());
    }

    @Transactional
    public ChatMessageView sendMessage(CommunityUser user, String conversationId, Map<String, String> body) {
        requireMember(user, conversationId);
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation != null && "DIRECT".equals(conversation.getType())) {
            String otherUserId = memberMapper.listByConversationId(conversationId).stream()
                    .map(ConversationMember::getUserId)
                    .filter(memberId -> !user.getId().equals(memberId))
                    .findFirst()
                    .orElse(null);
            if (otherUserId != null && userBlockService.isBlockedEitherWay(user.getId(), otherUserId)) {
                throw new ContractException(ErrorCode.CONFLICT, "无法向该用户发送私信");
            }
        }
        String messageType = parseMessageType(body.get("type"));
        String attachmentUrl = trimToNull(body.get("attachmentUrl"));
        String attachmentName = trimToNull(body.get("attachmentName"));
        String messageBody = body.get("body");
        if (MSG_IMAGE.equals(messageType) || MSG_FILE.equals(messageType)) {
            if (attachmentUrl == null) {
                throw new FieldContractException("attachmentUrl", "附件地址不能为空");
            }
        } else if (messageBody == null || messageBody.isBlank()) {
            throw new FieldContractException("body", "消息内容不能为空");
        }
        String clientMessageId = trimToNull(body.get("clientMessageId"));
        if (clientMessageId != null) {
            ChatMessage existing = messageMapper.findByClientMessageId(conversationId, user.getId(), clientMessageId);
            if (existing != null) {
                return toMessageView(existing);
            }
        }
        long nextSequence = messageMapper.maxSequenceNumber(conversationId) + 1;
        Instant now = Instant.now();
        ChatMessage message = new ChatMessage();
        message.setId(TokenSupport.newId());
        message.setConversationId(conversationId);
        message.setSenderId(user.getId());
        message.setSequenceNumber(nextSequence);
        message.setMessageType(messageType);
        message.setAttachmentUrl(attachmentUrl);
        message.setAttachmentName(attachmentName);
        message.setBody(messageBody == null || messageBody.isBlank() ? attachmentUrl : messageBody.trim());
        message.setClientMessageId(clientMessageId);
        message.setCreatedAt(now);
        messageMapper.insert(message);
        if (conversation != null) {
            conversation.setUpdatedAt(now);
            conversationMapper.updateById(conversation);
        }
        ChatMessageView view = toMessageView(message);
        eventPublisher.publishEvent(new ChatMessageSentEvent(conversationId, view));
        return view;
    }

    private static Long parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(cursor.trim());
        } catch (NumberFormatException ex) {
            throw new FieldContractException("cursor", "游标格式无效");
        }
    }

    private static long parseSequence(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("sequenceNumber", "已读序号不能为空");
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ex) {
            throw new FieldContractException("sequenceNumber", "已读序号格式无效");
        }
    }

    private Conversation requireGroup(String conversationId) {
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null || !"GROUP".equals(conversation.getType())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return conversation;
    }

    private ConversationView buildConversationView(
            Conversation conversation,
            String userId,
            List<ChatMessageView> messages) {
        ConversationMember member = memberMapper.findByConversationAndUser(conversation.getId(), userId);
        ChatMessage last = messageMapper.findLastByConversationId(conversation.getId());
        return ConversationView.builder()
                .id(conversation.getId())
                .type(conversation.getType())
                .title(conversation.getTitle())
                .updatedAt(conversation.getUpdatedAt())
                .lastMessage(formatLastMessagePreview(last))
                .unreadCount(messageMapper.countUnread(conversation.getId(), userId))
                .announcement(conversation.getAnnouncement())
                .announcementUpdatedAt(conversation.getAnnouncementUpdatedAt())
                .joinMode(conversation.getJoinMode() == null ? JOIN_OPEN : conversation.getJoinMode())
                .myRole(member == null ? null : member.getRole())
                .messages(messages)
                .build();
    }

    private GroupJoinRequestView toJoinRequestView(GroupJoinRequest request) {
        CommunityProfile profile = profileMapper.findByUserId(request.getUserId());
        return new GroupJoinRequestView(
                request.getId(),
                request.getConversationId(),
                request.getUserId(),
                profile == null ? request.getUserId() : profile.getUsername(),
                profile == null ? null : profile.getDisplayName(),
                request.getMessage(),
                request.getStatus(),
                request.getCreatedAt());
    }

    private void insertMember(String conversationId, String userId, String role, Instant joinedAt) {
        ConversationMember member = new ConversationMember();
        member.setId(TokenSupport.newId());
        member.setConversationId(conversationId);
        member.setUserId(userId);
        member.setRole(role);
        member.setLastReadSequence(0L);
        member.setJoinedAt(joinedAt);
        memberMapper.insert(member);
    }

    private ConversationMember requireMember(CommunityUser user, String conversationId) {
        ConversationMember member = memberMapper.findByConversationAndUser(conversationId, user.getId());
        if (member == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return member;
    }

    private ConversationMember requireOwnerOrAdmin(CommunityUser user, String conversationId) {
        ConversationMember member = requireMember(user, conversationId);
        if (!"OWNER".equals(member.getRole()) && !"ADMIN".equals(member.getRole())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN);
        }
        return member;
    }

    private ChatMessageView toMessageView(ChatMessage message) {
        return toMessageView(message, null);
    }

    private ChatMessageView toMessageView(ChatMessage message, String conversationType) {
        if (message.getRecalledAt() != null) {
            return ChatMessageView.builder()
                    .id(message.getId())
                    .conversationId(message.getConversationId())
                    .conversationType(conversationType)
                    .senderId(message.getSenderId())
                    .sequenceNumber(message.getSequenceNumber() == null ? 0L : message.getSequenceNumber())
                    .body("[消息已撤回]")
                    .messageType(message.getMessageType() == null ? MSG_TEXT : message.getMessageType())
                    .attachmentUrl(null)
                    .attachmentName(null)
                    .createdAt(message.getCreatedAt())
                    .recalledAt(message.getRecalledAt())
                    .build();
        }
        return ChatMessageView.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .conversationType(conversationType)
                .senderId(message.getSenderId())
                .sequenceNumber(message.getSequenceNumber() == null ? 0L : message.getSequenceNumber())
                .body(message.getBody())
                .messageType(message.getMessageType() == null ? MSG_TEXT : message.getMessageType())
                .attachmentUrl(message.getAttachmentUrl())
                .attachmentName(message.getAttachmentName())
                .createdAt(message.getCreatedAt())
                .recalledAt(message.getRecalledAt())
                .build();
    }

    private static String formatLastMessagePreview(ChatMessage message) {
        if (message == null) {
            return null;
        }
        if (message.getRecalledAt() != null) {
            return "[消息已撤回]";
        }
        String type = message.getMessageType() == null ? MSG_TEXT : message.getMessageType();
        if (MSG_IMAGE.equals(type)) {
            return "[图片]";
        }
        if (MSG_FILE.equals(type)) {
            return message.getAttachmentName() == null || message.getAttachmentName().isBlank()
                    ? "[文件]"
                    : "[文件] " + message.getAttachmentName();
        }
        String body = message.getBody();
        if (body == null || body.isBlank()) {
            return null;
        }
        return body.length() > 120 ? body.substring(0, 120) + "…" : body;
    }

    private static String parseMessageType(String raw) {
        if (raw == null || raw.isBlank()) {
            return MSG_TEXT;
        }
        String value = raw.trim().toUpperCase();
        if (MSG_TEXT.equals(value) || MSG_IMAGE.equals(value) || MSG_FILE.equals(value)) {
            return value;
        }
        throw new FieldContractException("type", "消息类型无效");
    }

    private static String parseJoinMode(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        if (!JOIN_OPEN.equals(value) && !JOIN_APPROVAL.equals(value)) {
            throw new FieldContractException("joinMode", "入群模式无效");
        }
        return value;
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String resolveUserId(String raw) {
        String candidate = trimToNull(raw);
        if (candidate == null) {
            throw new FieldContractException("userId", "用户标识不能为空");
        }
        if (userMapper.selectById(candidate) != null) {
            return candidate;
        }
        CommunityProfile profile = profileMapper.findByUsername(candidate.toLowerCase());
        if (profile != null) {
            return profile.getUserId();
        }
        return candidate;
    }
}
