package top.pxczxn.xingyu.community.identity;

import top.pxczxn.xingyu.community.entity.CommunityUser;

import java.time.Instant;

/**
 * 社区身份只读视图。不含 {@code password_hash}。
 *
 * <p>{@code communityRole} 是 {@code community_user.role} 列，不是 {@code community_user_role} 授予。
 */
public record CommunityIdentityView(
        String id,
        String email,
        String phone,
        String status,
        String communityRole,
        Instant emailVerifiedAt,
        Instant phoneVerifiedAt,
        boolean emailVerified,
        Instant createdAt) {

    static CommunityIdentityView from(CommunityUser user) {
        return new CommunityIdentityView(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus(),
                user.getRole(),
                user.getEmailVerifiedAt(),
                user.getPhoneVerifiedAt(),
                user.getEmailVerifiedAt() != null,
                user.getCreatedAt());
    }
}
