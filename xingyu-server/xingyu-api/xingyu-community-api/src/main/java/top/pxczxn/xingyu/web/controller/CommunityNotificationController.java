package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
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

    @GetMapping("/notifications")
    public List<NotificationView> list(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return notificationService.list(CommunityAuthContext.requireUser(), limit);
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
