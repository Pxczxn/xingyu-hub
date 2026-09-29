package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.CollaborationInviteView;
import top.pxczxn.xingyu.community.entity.CollaborationInvite;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CollaborationInviteMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CollaborationService {

    private final CollaborationInviteMapper inviteMapper;
    private final CommunityProfileMapper profileMapper;

    @Transactional
    public CollaborationInviteView createInvite(CommunityUser user, String note) {
        Instant now = Instant.now();
        CollaborationInvite invite = new CollaborationInvite();
        invite.setId(TokenSupport.newId());
        invite.setInviterId(user.getId());
        invite.setToken(UUID.randomUUID().toString().replace("-", ""));
        invite.setNote(note == null || note.isBlank() ? null : note.trim());
        invite.setExpiresAt(now.plus(7, ChronoUnit.DAYS));
        invite.setCreatedAt(now);
        inviteMapper.insert(invite);
        return toView(invite);
    }

    public Map<String, Object> resolveInvite(String token) {
        CollaborationInvite invite = inviteMapper.findByToken(token);
        if (invite == null || invite.getExpiresAt().isBefore(Instant.now())) {
            return Map.of("valid", false);
        }
        var profile = profileMapper.findByUserId(invite.getInviterId());
        return Map.of(
                "valid", true,
                "inviterUsername", profile == null ? invite.getInviterId() : profile.getUsername(),
                "inviterDisplayName", profile == null ? null : profile.getDisplayName(),
                "note", invite.getNote() == null ? "" : invite.getNote(),
                "expiresAt", invite.getExpiresAt().toString());
    }

    public Map<String, Object> acceptInvite(CommunityUser user, String token) {
        CollaborationInvite invite = inviteMapper.findByToken(token);
        if (invite == null || invite.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.NOT_FOUND, "邀请已失效或不存在");
        }
        if (invite.getInviterId().equals(user.getId())) {
            throw new ContractException(ErrorCode.CONFLICT, "不能接受自己的邀请");
        }
        var profile = profileMapper.findByUserId(invite.getInviterId());
        return Map.of(
                "accepted", true,
                "inviterUsername", profile == null ? invite.getInviterId() : profile.getUsername(),
                "inviterDisplayName", profile == null ? null : profile.getDisplayName(),
                "note", invite.getNote() == null ? "" : invite.getNote());
    }

    private CollaborationInviteView toView(CollaborationInvite invite) {
        return new CollaborationInviteView(
                invite.getId(),
                invite.getToken(),
                "/studio/collaboration/accept?token=" + invite.getToken(),
                invite.getNote(),
                invite.getExpiresAt());
    }
}
