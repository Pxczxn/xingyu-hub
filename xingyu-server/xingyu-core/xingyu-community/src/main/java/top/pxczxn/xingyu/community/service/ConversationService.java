package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.dto.ChatMessageSenderView;
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
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

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
    private final CommunityAccountService accountService;
    private final CommunityProperties communityProperties;
    private final ApplicationEventPublisher eventPublisher;

    /** 重连对账结果：升序消息 + 是否可能还有更多。 */
    public record MessageBackfillView(List<ChatMessageView> messages, boolean hasMore) {
    }

    /** 搜索落点用的一小段历史：升序消息 + 目标是否命中 + 目标序号。 */
    public record MessageContextView(
            List<ChatMessageView> messages, boolean found, long sequence) {
    }

    /** 通过 membership 校验后才存在的附件访问凭证。 */
    public record MessageAttachmentAccess(Long fileId, String fileName, String messageType) {
    }

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
        List<ChatMessageView> items = toViews(ordered, null);
        String nextCursor = items.isEmpty() ? null : String.valueOf(items.get(0).getSequenceNumber());
        return PageResultView.<ChatMessageView>builder()
                .items(items)
                .nextCursor(nextCursor)
                .total((long) items.size())
                .build();
    }

    /**
     * 会话内序号<b>大于</b> {@code afterSequence} 的消息，升序（2026-10-06 新增）。
     *
     * <p>存在的理由：{@link #listMessages} 只能往回翻，而断线期间漏掉的消息在「本地已知
     * 最大序号之后」。WebSocket 本身不重放离线消息，所以重连后必须用这个方向做一次 REST
     * 对账，否则「实时」会静默丢消息（实测：不补拉时，离线期间的消息刷新前一直不出现）。
     *
     * <p>用 {@code sequence_number} 而不是时间戳：它是会话内单调计数，「之后」是精确语义；
     * 通知那边只能给稳定顺序，给不了这个。
     *
     * <p>{@code afterSequence} 为 null 时从<b>最早</b>开始返回（升序），并用 hasMore 告知
     * 是否还有更多 —— 「没有游标」被明确定义成「从头开始」，而不是悄悄变成「最新一页」。
     * 客户端实际总是传本地已知最大序号，所以这个分支只是把语义钉死。
     *
     * @return 升序消息；外加是否可能还有更多（{@code hasMore}）
     */
    public MessageBackfillView listMessagesAfter(
            CommunityUser user,
            String conversationId,
            Long afterSequence,
            int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        // 多取一条用来判断是否还有后续，避免前端以为已经追平。
        List<ChatMessage> rows = messageMapper.listAfterSequence(conversationId, afterSequence, capped + 1);
        boolean hasMore = rows.size() > capped;
        List<ChatMessage> page = hasMore ? rows.subList(0, capped) : rows;
        return new MessageBackfillView(toViews(page, null), hasMore);
    }

    /**
     * 以某条消息为中心的一小段历史，升序（2026-10-06，供搜索结果精确落点用）。
     *
     * <p>为什么需要：搜索可以命中任意历史消息，而首屏只给最近 100 条。用「往回翻页直到碰到
     * 目标」在长会话里要翻几十次请求 —— 明确禁止。改成直接以目标的 {@code sequence_number}
     * 为中心取「前 N 条 + 目标 + 后 N 条」，一次请求就能定位。
     *
     * <p>{@code found=false} 表示这条序号在库里不存在（消息被删/ 从未存在），此时返回空列表，
     * 客户端应提示而不是死等。
     */
    public MessageContextView listMessagesAround(
            CommunityUser user, String conversationId, long sequence, int limit) {
        requireMember(user, conversationId);
        int window = Math.min(Math.max(limit, 3), 100);
        // limit 是**总共**返回多少条：目标自己占一条，其余分给前后（前面略多一条，
        // 因为「这条消息之前发生了什么」比之后更有助于理解上下文）。
        int before = (window - 1) / 2 + 1;
        int after = window - 1 - before;
        List<ChatMessage> older = messageMapper.listUpToSequence(conversationId, sequence - 1, before);
        List<ChatMessage> newer = messageMapper.listAfterSequence(conversationId, sequence, after);
        ChatMessage target = messageMapper.findBySequence(conversationId, sequence);
        if (target == null) {
            return new MessageContextView(List.of(), false, 0L);
        }
        List<ChatMessage> window0 = new ArrayList<>(older.size() + 1 + newer.size());
        window0.addAll(older);
        window0.add(target);
        window0.addAll(newer);
        return new MessageContextView(toViews(window0, null), true, sequence);
    }

    /**
     * 附件访问凭证：只在校验通过后返回，绝不把 {@code sys_file.id} 暴露给非成员。
     *
     * <p>为什么不直接用 {@code chat_message.attachment_url}：那是 {@code /admin/files/...}
     * 这种<b>无鉴权</b>的静态地址（实测不带 token 返回 200）。URL 只作展示，字节必须经
     * 这里 → {@code SysFileService.getFileBytes} 读，并先过 membership。
     */
    public MessageAttachmentAccess requireAttachment(
            CommunityUser user, String conversationId, String messageId) {
        requireMember(user, conversationId);
        ChatMessage message = messageMapper.findById(messageId);
        if (message == null
                || !conversationId.equals(message.getConversationId())
                || message.getAttachmentFileId() == null
                || message.getRecalledAt() != null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return new MessageAttachmentAccess(
                message.getAttachmentFileId(),
                message.getAttachmentName() == null ? "attachment" : message.getAttachmentName(),
                message.getMessageType() == null ? MSG_FILE : message.getMessageType());
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
            return toViews(List.of(message), null).get(0);
        }
        long elapsed = Instant.now().getEpochSecond() - message.getCreatedAt().getEpochSecond();
        if (elapsed > communityProperties.getMessageRecallWindowSeconds()) {
            throw new ContractException(ErrorCode.CONFLICT, "已超过可撤回时间窗口");
        }
        message.setRecalledAt(Instant.now());
        messageMapper.updateById(message);
        ChatMessageView view = toViews(List.of(message), null).get(0);
        eventPublisher.publishEvent(new CommunityChatRealtimeEvent(
                conversationId,
                "recall",
                Map.of("message", view)));
        return view;
    }

    public List<ChatMessageView> listMediaMessages(CommunityUser user, String conversationId, int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        return toViews(messageMapper.listByConversationIdAndType(conversationId, MSG_IMAGE, capped), null);
    }

    public List<ChatMessageView> listFileMessages(CommunityUser user, String conversationId, int limit) {
        requireMember(user, conversationId);
        int capped = Math.min(Math.max(limit, 1), 200);
        return toViews(messageMapper.listByConversationIdAndType(conversationId, MSG_FILE, capped), null);
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
        List<ChatMessage> hits = messageMapper.searchForUser(user.getId(), trimmed, capped);
        // 命中行要能回答「谁说的、来自哪个会话」，所以这里顺带把会话类型与对方展示名解析出来。
        // 之前两样都没有，实测结果行既无 sender 也无会话名（sender 由 toViews 统一填）。
        Map<String, Conversation> conversations = new HashMap<>();
        for (ChatMessage message : hits) {
            conversations.computeIfAbsent(
                    message.getConversationId(), conversationMapper::selectById);
        }
        Map<String, ChatMessageSenderView> senders = resolveSenders(hits);
        List<ChatMessageView> views = new ArrayList<>(hits.size());
        for (ChatMessage message : hits) {
            Conversation conversation = conversations.get(message.getConversationId());
            views.add(toMessageView(
                    message,
                    conversation == null ? null : conversation.getType(),
                    senders,
                    conversation == null ? null : resolveCounterpartDisplayName(conversation, user.getId())));
        }
        return views;
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
        // 停用 / 审核中 / 被拒的账号不能成为私信对象（2026-10-06）。此前只在这里校验
        // 「用户存在」，于是给他发消息能写库成功，而他自己登不进来 —— 消息进了一个没人
        // 读得走的会话。判定复用 CommunityAccountService 的统一口径，不在这里另写一套。
        accountService.requireCanParticipate(userMapper.selectById(resolvedUserId));
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
        // 锁会话行，而且必须是本事务的**第一条语句**。
        //
        // 序号是「读 max(sequence_number) + 1」算出来的，没有这把锁，两个并发发送会插同一个
        // sequence_number，撞 uk_chat_message_sequence → 500 且那条消息丢失（2026-10-06 实测：
        // 12 条并发里有 11 条 500，日志全是 duplicate entry ...-1）。
        //
        // 为什么必须放在最前面：MySQL 默认 REPEATABLE READ，事务的**一致性快照在第一条普通
        // SELECT 时建立**。若先做 requireMember（普通 SELECT）再取锁，快照早于前一个持锁者
        // 提交，于是后面的 MAX(sequence_number) 仍读到旧值 —— 实测正是这样：锁排了 466ms，
        // 拿到锁后读到的 max 还是 0。先取锁（锁定读不建立快照），随后的第一条普通 SELECT 才
        // 建立快照，此时前一个持锁者已提交，读到的就是最新值。
        Conversation conversation = conversationMapper.lockForUpdate(conversationId);
        if (conversation == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        requireMember(user, conversationId);
        if (conversation != null && "DIRECT".equals(conversation.getType())) {
            String otherUserId = memberMapper.listByConversationId(conversationId).stream()
                    .map(ConversationMember::getUserId)
                    .filter(memberId -> !user.getId().equals(memberId))
                    .findFirst()
                    .orElse(null);
            if (otherUserId != null) {
                if (userBlockService.isBlockedEitherWay(user.getId(), otherUserId)) {
                    throw new ContractException(ErrorCode.CONFLICT, "无法向该用户发送私信");
                }
                // 已有会话也不能继续往停用账号里写（2026-10-06）。与 openDirect 同一个
                // 统一口径：停用代表「不可参与社区交互」，而不仅是本人登不进来。
                accountService.requireCanParticipate(userMapper.selectById(otherUserId));
            }
        }
        String messageType = parseMessageType(body.get("type"));
        String attachmentUrl = trimToNull(body.get("attachmentUrl"));
        String attachmentName = trimToNull(body.get("attachmentName"));
        Long attachmentFileId = parseAttachmentFileId(body.get("attachmentFileId"));
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
                return toViews(List.of(existing), null).get(0);
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
        message.setAttachmentFileId(attachmentFileId);
        message.setBody(messageBody == null || messageBody.isBlank() ? attachmentUrl : messageBody.trim());
        message.setClientMessageId(clientMessageId);
        message.setCreatedAt(now);
        messageMapper.insert(message);
        if (conversation != null) {
            conversation.setUpdatedAt(now);
            conversationMapper.updateById(conversation);
        }
        ChatMessageView view = toViews(List.of(message), null).get(0);
        eventPublisher.publishEvent(new ChatMessageSentEvent(conversationId, view));
        return view;
    }

    private static Long parseAttachmentFileId(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new FieldContractException("attachmentFileId", "附件标识格式无效");
        }
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
                .counterpartDisplayName(resolveCounterpartDisplayName(conversation, userId))
                .messages(messages)
                .build();
    }

    /**
     * Display name of the OTHER participant in a DIRECT conversation, or null.
     *
     * Why the client needs it: a DIRECT conversation carries no {@code title}, so
     * the mailbox row and the thread header had nothing to show but 「私信」. On
     * the thread screen that is also the page heading, so the reader saw the same
     * word twice and never learned who they were talking to.
     *
     * Returns null for GROUP conversations — their title IS the group name — and
     * null when the counterpart's profile cannot be read, so the client falls
     * back to its own label instead of rendering a blank.
     *
     * Cost: two extra lookups per DIRECT conversation (members, then profile).
     * The caller already performs three per conversation (member, last message,
     * unread count), so this does not introduce a new class of problem — but it
     * does mean a mailbox of N conversations is 5N queries, and this loop is the
     * obvious place to batch if that ever becomes the bottleneck.
     */
    // Package-private, not private, so it can be unit-tested with mocked mappers.
    // It touches no database directly, so a mock is enough to verify the
    // resolution rules (self excluded, displayName preferred over username,
    // null-safe when the profile is missing).
    String resolveCounterpartDisplayName(Conversation conversation, String userId) {
        if (!"DIRECT".equals(conversation.getType())) {
            return null;
        }
        return memberMapper.listByConversationId(conversation.getId()).stream()
                .filter(m -> !userId.equals(m.getUserId()))
                .findFirst()
                .map(other -> {
                    CommunityProfile profile = profileMapper.findByUserId(other.getUserId());
                    if (profile == null) {
                        // Null, NOT the raw userId. A user id is an opaque string
                        // and printing it tells the reader nothing — the client
                        // falls back to its own label instead. This matches how
                        // MomentService treats a missing author profile.
                        return null;
                    }
                    String displayName = profile.getDisplayName();
                    return displayName == null || displayName.isBlank()
                            ? profile.getUsername()
                            : displayName;
                })
                .orElse(null);
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

    /**
     * 一批消息 → 视图，<b>sender 按 sender_id 去重后一次性批量解析</b>（2026-10-06）。
     *
     * <p>为什么必须批量：逐条 {@code findByUserId} 会让「一页 50 条消息」变成 50 次 profile
     * 查询。这里复用 {@code CommunityProfileMapper.findByUserIds}（项目已有的 IN 批量能力），
     * 一个会话页恒定 1 次查询。
     *
     * <p>解析的是<b>当前</b> profile，不是写入时的快照 —— 与通知的 actor 同一原则，所以
     * 发送者改名后历史消息仍显示并链接到当前 canonical identity。
     */
    private List<ChatMessageView> toViews(List<ChatMessage> messages, Function<String, String> typeOf) {
        Map<String, ChatMessageSenderView> senders = resolveSenders(messages);
        List<ChatMessageView> views = new ArrayList<>(messages.size());
        for (ChatMessage message : messages) {
            views.add(toMessageView(message, typeOf == null ? null : typeOf.apply(message.getConversationId()), senders));
        }
        return views;
    }

    private Map<String, ChatMessageSenderView> resolveSenders(List<ChatMessage> messages) {
        Set<String> senderIds = new LinkedHashSet<>();
        for (ChatMessage message : messages) {
            if (message.getSenderId() != null && !message.getSenderId().isBlank()) {
                senderIds.add(message.getSenderId());
            }
        }
        if (senderIds.isEmpty()) {
            return Map.of();
        }
        Map<String, ChatMessageSenderView> byUserId = new HashMap<>();
        for (CommunityProfile profile : profileMapper.findByUserIds(senderIds)) {
            byUserId.put(profile.getUserId(), ChatMessageSenderView.builder()
                    .userId(profile.getUserId())
                    .username(profile.getUsername())
                    .displayName(profile.getDisplayName())
                    // 头像不在 profile 列上，存在 settings_json 里 —— 复用既有解析口径。
                    .avatar(ProfileSettingsSupport.resolveAvatar(profile))
                    .build());
        }
        return byUserId;
    }

    private ChatMessageView toMessageView(
            ChatMessage message,
            String conversationType,
            Map<String, ChatMessageSenderView> senders) {
        return toMessageView(message, conversationType, senders, null);
    }

    private ChatMessageView toMessageView(
            ChatMessage message,
            String conversationType,
            Map<String, ChatMessageSenderView> senders,
            String counterpartDisplayName) {
        ChatMessageSenderView sender = message.getSenderId() == null
                ? null
                : senders.get(message.getSenderId());
        ChatMessageView.ChatMessageViewBuilder builder = ChatMessageView.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .conversationType(conversationType)
                .senderId(message.getSenderId())
                .sender(sender)
                .counterpartDisplayName(counterpartDisplayName)
                .sequenceNumber(message.getSequenceNumber() == null ? 0L : message.getSequenceNumber())
                .createdAt(message.getCreatedAt())
                .recalledAt(message.getRecalledAt());
        if (message.getRecalledAt() != null) {
            // 墓碑：保留位置与身份，但内容与附件都不再返回。
            return builder
                    .body("[消息已撤回]")
                    .messageType(message.getMessageType() == null ? MSG_TEXT : message.getMessageType())
                    .attachmentUrl(null)
                    .attachmentName(null)
                    .attachmentFileId(null)
                    .recallUntil(null)
                    .build();
        }
        return builder
                .body(message.getBody())
                .messageType(message.getMessageType() == null ? MSG_TEXT : message.getMessageType())
                .attachmentUrl(message.getAttachmentUrl())
                .attachmentName(message.getAttachmentName())
                .attachmentFileId(message.getAttachmentFileId())
                // 撤回截止时刻由服务端按同一套窗口规则算，客户端不必复制那个常量。
                .recallUntil(recallUntilOf(message))
                .build();
    }

    /**
     * 撤回截止时刻 = 创建时间 + 服务端配置的窗口。
     *
     * <p>唯一的规则来源在这里；客户端只拿它和「现在」比。已撤回的消息返回 null。
     */
    private Instant recallUntilOf(ChatMessage message) {
        if (message.getRecalledAt() != null || message.getCreatedAt() == null) {
            return null;
        }
        return message.getCreatedAt().plusSeconds(communityProperties.getMessageRecallWindowSeconds());
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
