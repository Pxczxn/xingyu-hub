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
}
