package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.NotificationView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Notification;
import top.pxczxn.xingyu.community.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;

    public List<NotificationView> list(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 50;
        }
        return notificationMapper.listByUserId(user.getId(), limit).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public NotificationView markRead(CommunityUser user, String notificationId) {
        Notification notification = notificationMapper.selectById(notificationId);
        if (notification == null || !user.getId().equals(notification.getUserId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now());
            notificationMapper.updateById(notification);
        }
        return toView(notification);
    }

    @Transactional
    public void markAllRead(CommunityUser user) {
        notificationMapper.markAllRead(user.getId());
    }

    private NotificationView toView(Notification notification) {
        return NotificationView.builder()
                .id(notification.getId())
                .category(notification.getCategory())
                .title(notification.getTitle())
                .body(notification.getBody())
                .read(notification.getReadAt() != null)
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
