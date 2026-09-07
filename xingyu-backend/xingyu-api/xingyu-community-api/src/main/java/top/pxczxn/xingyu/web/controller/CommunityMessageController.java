package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ChatMessageView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.ConversationMemberView;
import top.pxczxn.xingyu.community.dto.ConversationView;
import top.pxczxn.xingyu.community.dto.GroupJoinRequestView;
import top.pxczxn.xingyu.community.service.ConversationService;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.service.SysFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/messages")
@RequiredArgsConstructor
public class CommunityMessageController {

    private static final Set<String> COMMUNITY_ATTACHMENT_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "md", "csv", "zip");

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

    @PostMapping("/upload")
    public Map<String, String> uploadMessageAttachment(@RequestParam("file") MultipartFile file) {
        validateCommunityAttachment(file);
        SysFile uploaded = fileService.upload(file, "community/messages");
        return Map.of(
                "url", uploaded.getUrl(),
                "name", uploaded.getOriginalName() == null ? "file" : uploaded.getOriginalName(),
                "mimeType", uploaded.getFileType() == null ? "" : uploaded.getFileType());
    }

    private void validateCommunityAttachment(MultipartFile file) {
        String filename = file == null ? null : file.getOriginalFilename();
        if (filename == null || filename.isBlank() || !filename.contains(".")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "附件文件名必须包含允许的扩展名");
        }
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!COMMUNITY_ATTACHMENT_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该附件类型不允许上传");
        }
    }

    @GetMapping("/{conversationId}/messages")
    public PageResultView<ChatMessageView> listMessages(
            @PathVariable String conversationId,
            @RequestParam(value = "cursor", required = false) String cursor,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return conversationService.listMessages(
                CommunityAuthContext.requireUser(), conversationId, cursor, limit);
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
