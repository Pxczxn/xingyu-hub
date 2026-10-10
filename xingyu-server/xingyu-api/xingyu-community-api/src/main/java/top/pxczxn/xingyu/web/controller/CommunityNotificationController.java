package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.NotificationUnreadCountView;
import top.pxczxn.xingyu.community.dto.NotificationView;
import top.pxczxn.xingyu.community.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CommunityNotificationController {

    private final NotificationService notificationService;

    /**
     * 会话用户的通知，最新在前。
     *
     * <p>{@code limit} 非正数落到默认 50，超过 100 压到 100（见 NotificationService）。
     * 没有 cursor —— 分页是明确的后续 debt，本端点只提供一个窗口。
     */
    @GetMapping("/notifications")
    public List<NotificationView> list(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return notificationService.list(CommunityAuthContext.requireUser(), limit);
    }

    /**
     * 未读数。Header 角标的事实源：比 {@code GET /home} 便宜得多，且语义就是通知本身。
     * 路径落在 {@code /notifications/**} 之下，已由 CommunityAuthInterceptor 保护。
     */
    @GetMapping("/notifications/unread-count")
    public NotificationUnreadCountView unreadCount() {
        return NotificationUnreadCountView.builder()
                .unread(notificationService.unreadCount(CommunityAuthContext.requireUser()))
                .build();
    }

    @PatchMapping("/notifications/{notificationId}/read")
    public NotificationView markRead(@PathVariable String notificationId) {
        return notificationService.markRead(CommunityAuthContext.requireUser(), notificationId);
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllRead() {
        notificationService.markAllRead(CommunityAuthContext.requireUser());
        return ResponseEntity.noContent().build();
    }
}
