package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class MomentView {
    String id;
    String body;
    String authorId;
    /**
     * Author's handle and display name, resolved from the community profile.
     *
     * Added 2026-10-03. {@link #authorId} alone was not enough: a moment feed
     * that can only show an opaque id cannot say who wrote anything, and the
     * frontend had no way to resolve it without an extra request per row.
     *
     * Both are null when the profile cannot be read. Clients must treat null as
     * "unknown author" and fall back to their own label — never render a blank.
     *
     * There is deliberately no `authorAvatar`: the community profile table has
     * no avatar column (the only avatar fields in the backend are on the auth
     * and system users, which are a different thing). Adding one here would mean
     * inventing data that does not exist.
     */
    String authorUsername;
    String authorDisplayName;
    Instant createdAt;

    /**
     * Engagement counters, filled by the feed list and a public profile's moment list (2026-10-28,
     * profile list 2026-10-30).
     *
     * <p>Added so a moment card can show 点赞 / 评论 on the card itself. Before this the feed had
     * to either issue one `GET /likes/MOMENT/{id}/count` per row — N+1 requests for a page that
     * shows 20 — or offer no engagement at all, which is what it did. The counts are computed in
     * one batch query by {@code EngagementMetricsService}.
     *
     * <p>{@link #liked} is the VIEWER's state and is deliberately a nullable {@code Boolean}, not a
     * primitive: {@code null} means "nobody is signed in, so we never asked", which is a different
     * answer from {@code false} ("signed in, not liked"). Collapsing the two would make a guest's
     * unliked card indistinguishable from a signed-in reader's, and the frontend could not tell
     * whether to offer 点赞 or 登录后互动.
     *
     * <p>These stay null on the single-moment endpoints (publish / update / trash), which return
     * the author's own write straight back and have no viewer-scoped audience to answer for.
     */
    Long likeCount;
    Long commentCount;
    Boolean liked;
}
