package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ChatMessageView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.ConversationMemberView;
import top.pxczxn.xingyu.community.dto.ConversationView;
import top.pxczxn.xingyu.community.dto.GroupJoinRequestView;
import top.pxczxn.xingyu.community.service.ConversationService;
import top.pxczxn.xingyu.community.service.ConversationService.MessageBackfillView;
import top.pxczxn.xingyu.community.service.ConversationService.MessageContextView;
import top.pxczxn.xingyu.file.community.CommunityFilePurpose;
import top.pxczxn.xingyu.file.community.CommunityFileUploadCommand;
import top.pxczxn.xingyu.file.community.CommunityUploadedFileView;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.service.SysFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/messages")
@RequiredArgsConstructor
public class CommunityMessageController {

    private final ConversationService conversationService;
    private final SysFileService fileService;

    @GetMapping
    public List<ConversationView> listConversations() {
        return conversationService.listConversations(CommunityAuthContext.requireUser());
    }

    @GetMapping("/direct/{conversationId}")
    public ConversationView getDirect(@PathVariable String conversationId) {
        return conversationService.getDirectConversation(CommunityAuthContext.requireUser(), conversationId);
    }

    @PostMapping("/direct/{otherUserId}")
    public ConversationView openDirect(@PathVariable String otherUserId) {
        return conversationService.openDirect(CommunityAuthContext.requireUser(), otherUserId);
    }

    @PostMapping("/direct/{conversationId}/messages")
    public ChatMessageView sendDirectMessage(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> body) {
        return conversationService.sendMessage(CommunityAuthContext.requireUser(), conversationId, body);
    }

    @PostMapping("/group")
    public ConversationView createGroup(@RequestBody Map<String, String> body) {
        return conversationService.createGroup(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/group/{conversationId}")
    public ConversationView getGroup(@PathVariable String conversationId) {
        return conversationService.getGroupConversation(CommunityAuthContext.requireUser(), conversationId);
    }

    @PostMapping("/group/{conversationId}/messages")
    public ChatMessageView sendGroupMessage(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> body) {
        return conversationService.sendMessage(CommunityAuthContext.requireUser(), conversationId, body);
    }

    @GetMapping("/group/{conversationId}/members")
    public List<ConversationMemberView> groupMembers(@PathVariable String conversationId) {
        return conversationService.listMembers(CommunityAuthContext.requireUser(), conversationId);
    }

    @PatchMapping("/group/{conversationId}/announcement")
    public ConversationView updateGroupAnnouncement(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> body) {
        return conversationService.updateGroupAnnouncement(
                CommunityAuthContext.requireUser(), conversationId, body);
    }

    @PatchMapping("/group/{conversationId}/settings")
    public ConversationView updateGroupSettings(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> body) {
        return conversationService.updateGroupSettings(
                CommunityAuthContext.requireUser(), conversationId, body);
    }

    @GetMapping("/group/{conversationId}/join-requests")
    public List<GroupJoinRequestView> listJoinRequests(@PathVariable String conversationId) {
        return conversationService.listJoinRequests(CommunityAuthContext.requireUser(), conversationId);
    }

    @PostMapping("/group/{conversationId}/join-requests")
    public GroupJoinRequestView submitJoinRequest(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> body) {
        return conversationService.submitJoinRequest(
                CommunityAuthContext.requireUser(), conversationId, body);
    }

    @PostMapping("/group/{conversationId}/join-requests/{requestId}/approve")
    public ResponseEntity<Void> approveJoinRequest(
            @PathVariable String conversationId,
            @PathVariable String requestId) {
        conversationService.approveJoinRequest(
                CommunityAuthContext.requireUser(), conversationId, requestId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/group/{conversationId}/join-requests/{requestId}/reject")
    public ResponseEntity<Void> rejectJoinRequest(
            @PathVariable String conversationId,
            @PathVariable String requestId) {
        conversationService.rejectJoinRequest(
                CommunityAuthContext.requireUser(), conversationId, requestId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 上传私信附件（不创建消息）。
     *
     * <p>返回里新增 {@code fileId}（2026-10-06）：发消息时带上它，消息行就会记住
     * {@code sys_file.id}，之后下载走带 membership 校验的受鉴权端点。{@code url} 仍返回，
     * 但它只是展示用地址，对应目录已被 {@code FileAccessController} 拒绝静态访问。
     */
    @PostMapping("/upload")
    public Map<String, Object> uploadMessageAttachment(@RequestParam("file") MultipartFile file) {
        String uploaderId = CommunityAuthContext.requireUser().getId();
        CommunityUploadedFileView uploaded = fileService.uploadCommunity(
                file,
                CommunityFileUploadCommand.builder()
                        .purpose(CommunityFilePurpose.MESSAGE_ATTACHMENT)
                        .ownerUserId(uploaderId)
                        .build());
        return Map.of(
                "url", uploaded.getUrl(),
                "name", uploaded.getName(),
                "mimeType", uploaded.getMimeType(),
                "fileId", uploaded.getFileId());
    }

    /**
     * 一页历史消息，<b>往回</b>翻（{@code cursor} = 已持有的最旧序号）。
     *
     * <p>方向说明：重连对账要的是<b>往后</b>（{@code afterSequence}），见下一个端点。
     * 两个方向都用 {@code sequence_number} 而不是时间戳 —— 它是会话内单调计数，
     * 「之后」是精确语义。
     */
    @GetMapping("/{conversationId}/messages")
    public PageResultView<ChatMessageView> listMessages(
            @PathVariable String conversationId,
            @RequestParam(value = "cursor", required = false) String cursor,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.listMessages(
                CommunityAuthContext.requireUser(), conversationId, cursor, limit);
    }

    /**
     * 补齐 {@code afterSequence} 之后的消息，升序（2026-10-06 新增）。
     *
     * <p>为什么需要：WebSocket 只做实时推送，<b>不重放离线期间的消息</b>。重连后如果只
     * 重新握手，断线期间的消息会静默丢失（实测：不调本端点时，刷新前一直看不到）。
     * 前端用本地已知最大序号调用本端点即可对账。
     *
     * <p>响应形状刻意与上面那个不同（{@code messages + hasMessageMore}，而不是
     * {@code items + nextCursor}）：{@code nextCursor} 在前者表示「更旧」，方向相反，
     * 混用极易写反。
     */
    @GetMapping("/{conversationId}/messages/after")
    public MessageBackfillView listMessagesAfter(
            @PathVariable String conversationId,
            @RequestParam(value = "afterSequence", required = false) String afterSequence,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.listMessagesAfter(
                CommunityAuthContext.requireUser(),
                conversationId,
                afterSequence == null || afterSequence.isBlank() ? null : Long.valueOf(afterSequence.trim()),
                limit);
    }

    /**
     * 私信附件下载 —— <b>受鉴权</b>（2026-10-06 安全 blocker）。
     *
     * <p>此前附件地址是 {@code /api/v1/admin/files/community/messages/<hash>}，
     * {@code FileAccessController} 对它<b>不做任何会话校验</b>（实测不带 token 返回 200），
     * 于是「路径难猜」成了唯一屏障。现在该前缀已被那条控制器显式拒绝，字节只能经由这里
     * 取得，而这里先过 {@code requireMember}：非成员一律 404，不泄漏附件是否存在。
     *
     * <p>用项目既有的 {@code SysFileService.getFileBytes}（local / MinIO 都支持）读字节，
     * 没有另造一套文件读取。
     */
    /**
     * 以某条消息为中心的一小段历史（2026-10-06，搜索结果精确落点用）。
     *
     * <p>{@code sequence} 是会话内的单调序号，来自消息载荷；一次请求返回「目标之前 + 目标 +
     * 目标之后」的一小段（升序）。这样从搜索点进一条很旧的消息时，不需要从最新一页一路往前翻。
     */
    @GetMapping("/{conversationId}/messages/around")
    public MessageContextView listMessagesAround(
            @PathVariable String conversationId,
            @RequestParam("sequence") long sequence,
            @RequestParam(value = "limit", defaultValue = "30") int limit) {
        return conversationService.listMessagesAround(
                CommunityAuthContext.requireUser(), conversationId, sequence, limit);
    }

    @GetMapping("/{conversationId}/messages/{messageId}/attachment")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable String conversationId,
            @PathVariable String messageId) {
        ConversationService.MessageAttachmentAccess access = conversationService.requireAttachment(
                CommunityAuthContext.requireUser(), conversationId, messageId);
        SysFile file = fileService.getById(access.fileId());
        if (file == null) {
            return ResponseEntity.notFound().build();
        }
        byte[] bytes = fileService.getFileBytes(access.fileId());
        String contentType = file.getFileType() == null || file.getFileType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : file.getFileType();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + sanitizeFileName(access.fileName()) + "\"")
                .body(bytes);
    }

    /** 文件名会进响应头，去掉引号与换行，避免头注入 / 头部截断。 */
    private static String sanitizeFileName(String raw) {
        String name = raw == null ? "attachment" : raw.trim();
        name = name.replaceAll("[\"\\r\\n]", "_");
        return name.isEmpty() ? "attachment" : name;
    }

    @PatchMapping("/{conversationId}/read")
    public ResponseEntity<Void> markRead(
            @PathVariable String conversationId,
            @RequestBody(required = false) Map<String, String> body) {
        conversationService.markConversationRead(
                CommunityAuthContext.requireUser(), conversationId, body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/messages/{messageId}/recall")
    public ChatMessageView recallMessage(
            @PathVariable String conversationId,
            @PathVariable String messageId) {
        return conversationService.recallMessage(
                CommunityAuthContext.requireUser(), conversationId, messageId);
    }

    @GetMapping("/{conversationId}/media")
    public List<ChatMessageView> conversationMedia(
            @PathVariable String conversationId,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.listMediaMessages(
                CommunityAuthContext.requireUser(), conversationId, limit);
    }

    @GetMapping("/{conversationId}/files")
    public List<ChatMessageView> conversationFiles(
            @PathVariable String conversationId,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.listFileMessages(
                CommunityAuthContext.requireUser(), conversationId, limit);
    }

    @GetMapping("/search")
    public List<ChatMessageView> searchMessages(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.searchMessages(
                CommunityAuthContext.requireUser(), query, limit);
    }

    @PostMapping("/group/{conversationId}/leave")
    public ResponseEntity<Void> leaveGroup(@PathVariable String conversationId) {
        conversationService.leaveGroup(CommunityAuthContext.requireUser(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/group/{conversationId}/members/{userId}")
    public ResponseEntity<Void> removeGroupMember(
            @PathVariable String conversationId,
            @PathVariable String userId) {
        conversationService.removeMember(CommunityAuthContext.requireUser(), conversationId, userId);
        return ResponseEntity.noContent().build();
    }
}
