package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class ConversationView {
    String id;
    String type;
    String title;
    Instant updatedAt;
    String lastMessage;
    Long unreadCount;
    String announcement;
    Instant announcementUpdatedAt;
    String joinMode;
    String myRole;
    /**
     * Display name of the OTHER participant, for DIRECT conversations only.
     *
     * Added 2026-10-03. A direct conversation has no {@link #title} — the column
     * is null for DIRECT rows — so every direct surface had nothing to print but
     * the literal string 「私信」. On the thread screen that collided with the
     * page's own heading, so the reader saw 「私信」 twice and never saw who they
     * were talking to.
     *
     * Null for GROUP conversations (their {@link #title} is the group name) and
     * null if the counterpart's profile cannot be read. Clients must treat null
     * as "no name available" and fall back — never as an empty name to render.
     */
    String counterpartDisplayName;
    List<ChatMessageView> messages;
}
