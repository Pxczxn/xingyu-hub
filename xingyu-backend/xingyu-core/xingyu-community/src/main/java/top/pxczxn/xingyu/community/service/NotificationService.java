package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.NotificationView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Notification;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.NotificationMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;
    private final CommunityProfileMapper profileMapper;

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

    @Transactional
    public void notifyUserFollowed(CommunityUser follower, String followeeId) {
        if (follower.getId().equals(followeeId)) {
            return;
        }
        CommunityProfile followerProfile = profileMapper.findByUserId(follower.getId());
        String username = followerProfile == null ? null : followerProfile.getUsername();
        String displayName = resolveDisplayName(followerProfile);
        String body = username == null || username.isBlank()
                ? displayName + " 开始关注你"
                : "@" + username + " 开始关注你";

        Notification notification = new Notification();
        notification.setId(TokenSupport.newId());
        notification.setUserId(followeeId);
        notification.setCategory("FOLLOW");
        notification.setTitle(displayName + " 关注了你");
        notification.setBody(body);
        notification.setCreatedAt(Instant.now());
        notificationMapper.insert(notification);
    }

    private static String resolveDisplayName(CommunityProfile profile) {
        if (profile == null) {
            return "某位用户";
        }
        if (profile.getDisplayName() != null && !profile.getDisplayName().isBlank()) {
            return profile.getDisplayName().trim();
        }
        if (profile.getUsername() != null && !profile.getUsername().isBlank()) {
            return profile.getUsername().trim();
        }
        return "某位用户";
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
