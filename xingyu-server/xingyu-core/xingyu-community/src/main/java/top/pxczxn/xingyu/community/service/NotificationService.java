package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.NotificationActorView;
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
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationService {

    /**
     * 默认窗口。历史上是"固定最近 50 条"，没有 cursor；本轮不引入分页 UI，所以这个值不变，
     * 但补一个上限（见 {@link #MAX_LIMIT}）——原来 limit 只被兜底到 50，传 1000000 就照单全收。
     */
    private static final int DEFAULT_LIMIT = 50;

    /**
     * 单次可读窗口的上限。分页契约（cursor）是明确的后续 debt，这里只是防止调用方拉爆整表。
     * 选 100 而不是 50：给未来留一倍余量，且小到不需要分页 UI 也不会失控。
     */
    private static final int MAX_LIMIT = 100;

    private final NotificationMapper notificationMapper;
    private final CommunityProfileMapper profileMapper;

    public List<NotificationView> list(CommunityUser user, int limit) {
        List<Notification> rows = notificationMapper.listByUserId(user.getId(), clampLimit(limit));
        Map<String, CommunityProfile> actors = resolveActors(rows);
        return rows.stream()
                .map(row -> toView(row, actors))
                .toList();
    }

    /** 未读数（全账户，与 list 的窗口无关）。Header 角标以此为事实源。 */
    public long unreadCount(CommunityUser user) {
        return notificationMapper.countUnread(user.getId());
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
        return toView(notification, resolveActors(List.of(notification)));
    }

    @Transactional
    public void markAllRead(CommunityUser user) {
        notificationMapper.markAllRead(user.getId());
    }

    /**
     * FOLLOW 通知：把「谁关注了你」写成一条可导航的通知。
     *
     * <p>写入的是 {@code actorUserId}（follower 的稳定 user_id），不是 username —— 见
     * {@link Notification}。文案只保留一句（title），不再用 body 把"关注了你"说第二遍。
     */
    @Transactional
    public void notifyUserFollowed(CommunityUser follower, String followeeId) {
        if (follower.getId().equals(followeeId)) {
            return;
        }
        CommunityProfile followerProfile = profileMapper.findByUserId(follower.getId());
        String displayName = resolveDisplayName(followerProfile);

        Notification notification = new Notification();
        notification.setId(TokenSupport.newId());
        notification.setUserId(followeeId);
        notification.setActorUserId(follower.getId());
        notification.setCategory("FOLLOW");
        notification.setTitle(displayName + " 关注了你");
        // body 故意留空：title 已经完整表达「谁 · 做了什么」，再来一句「@xxx 开始关注你」
        // 是同一件事说两遍（审计结论）。
        notification.setBody(null);
        notification.setCreatedAt(Instant.now());
        notificationMapper.insert(notification);
    }

    /**
     * limit 兜底 + 上限钳制。非正数落到默认值，超过上限压到上限。
     */
    private static int clampLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    /**
     * 一次性把这一页的 actor 全部查出来，避免逐行 findByUserId 造成 N+1。
     *
     * <p>用 {@code IN} 批量查（复用 CommunityProfileMapper.findByUserIds），返回 userId -> profile
     * 的映射；查不到的 actor 在 {@link #toView} 里退化为 username=null，而不是丢掉整条通知。
     */
    private Map<String, CommunityProfile> resolveActors(List<Notification> rows) {
        Set<String> actorIds = new LinkedHashSet<>();
        for (Notification row : rows) {
            if (row.getActorUserId() != null && !row.getActorUserId().isBlank()) {
                actorIds.add(row.getActorUserId());
            }
        }
        if (actorIds.isEmpty()) {
            return Map.of();
        }
        Map<String, CommunityProfile> byUserId = new HashMap<>();
        for (CommunityProfile profile : profileMapper.findByUserIds(actorIds)) {
            byUserId.put(profile.getUserId(), profile);
        }
        return byUserId;
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

    private NotificationView toView(Notification notification, Map<String, CommunityProfile> actors) {
        return NotificationView.builder()
                .id(notification.getId())
                .category(notification.getCategory())
                .title(notification.getTitle())
                .body(notification.getBody())
                .read(notification.getReadAt() != null)
                .createdAt(notification.getCreatedAt())
                .actor(toActorView(notification.getActorUserId(), actors))
                .build();
    }

    /**
     * actor 视图：user_id 恒有；username / displayName 来自**当前** profile。
     *
     * <p>actorUserId 为空 → actor 为 null（这条通知没有 actor，例如系统类）；
     * 有 actorUserId 但查不到 profile → 仍返回 actor，只是 username=null，前端据此不渲染跳转。
     */
    private static NotificationActorView toActorView(
            String actorUserId, Map<String, CommunityProfile> actors) {
        if (actorUserId == null || actorUserId.isBlank()) {
            return null;
        }
        CommunityProfile profile = actors.get(actorUserId);
        return NotificationActorView.builder()
                .userId(actorUserId)
                .username(profile == null ? null : profile.getUsername())
                .displayName(profile == null ? null : profile.getDisplayName())
                .build();
    }
}
