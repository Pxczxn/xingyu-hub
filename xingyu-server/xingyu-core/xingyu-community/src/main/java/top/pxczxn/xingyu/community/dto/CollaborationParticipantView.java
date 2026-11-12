package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record CollaborationParticipantView(
        String userId,
        String username,
        String displayName,
        String role,
        Instant joinedAt) {}
