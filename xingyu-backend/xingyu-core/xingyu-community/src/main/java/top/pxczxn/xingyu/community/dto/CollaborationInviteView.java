package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record CollaborationInviteView(String id, String token, String inviteUrl, String note, Instant expiresAt) {}
