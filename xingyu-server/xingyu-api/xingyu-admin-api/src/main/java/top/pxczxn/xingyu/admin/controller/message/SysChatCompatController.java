package top.pxczxn.xingyu.admin.controller.message;

import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 旧版 Mars 私聊 API 兼容层。
 * sys_chat_message 表已在 V019 移除，此处返回空数据避免前端 404。
 */
@RestController
@RequestMapping("/sys/chat")
@RequiredArgsConstructor
public class SysChatCompatController {

    private final SysUserService userService;

    @PostMapping("/send")
    public Result<Map<String, Object>> send(@RequestBody Map<String, Object> body) {
        return Result.fail("私聊功能已迁移，请使用社区消息 API");
    }

    @GetMapping("/history/{targetId}")
    public Result<PageResult<CompatChatMessage>> history(
            @PathVariable Long targetId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        return Result.ok(PageResult.empty());
    }

    @GetMapping("/contacts")
    public Result<List<CompatChatMessage>> contacts() {
        return Result.ok(Collections.emptyList());
    }

    @GetMapping("/users")
    public Result<List<CompatChatUser>> users() {
        List<CompatChatUser> users = userService.listAll().stream()
                .filter(user -> user.getStatus() != null && user.getStatus() == 1)
                .map(this::toChatUser)
                .toList();
        return Result.ok(users);
    }

    @PostMapping("/read/{senderId}")
    public Result<Void> markRead(@PathVariable Long senderId) {
        return Result.ok();
    }

    @GetMapping("/unread-count")
    public Result<Integer> unreadCount() {
        return Result.ok(0);
    }

    @GetMapping("/online/{userId}")
    public Result<Boolean> online(@PathVariable Long userId) {
        return Result.ok(false);
    }

    @DeleteMapping("/clear/{targetId}")
    public Result<Void> clear(@PathVariable Long targetId) {
        return Result.ok();
    }

    @PostMapping("/block/{targetId}")
    public Result<Void> block(@PathVariable Long targetId) {
        return Result.ok();
    }

    @DeleteMapping("/block/{targetId}")
    public Result<Void> unblock(@PathVariable Long targetId) {
        return Result.ok();
    }

    @GetMapping("/blacklist")
    public Result<List<Object>> blacklist() {
        return Result.ok(Collections.emptyList());
    }

    @GetMapping("/blocked/{targetId}")
    public Result<Boolean> blocked(@PathVariable Long targetId) {
        return Result.ok(false);
    }

    private CompatChatUser toChatUser(SysUser user) {
        CompatChatUser chatUser = new CompatChatUser();
        chatUser.setId(user.getId());
        chatUser.setUsername(user.getUsername());
        chatUser.setNickname(user.getNickname());
        chatUser.setAvatar(user.getAvatar());
        return chatUser;
    }

    @Data
    public static class CompatChatMessage {
        private Long id;
        private Long senderId;
        private String senderName;
        private String senderAvatar;
        private Long receiverId;
        private String content;
        private Integer msgType;
        private Integer isRead;
        private String sendTime;
    }

    @Data
    public static class CompatChatUser {
        private Long id;
        private String username;
        private String nickname;
        private String avatar;
    }
}
