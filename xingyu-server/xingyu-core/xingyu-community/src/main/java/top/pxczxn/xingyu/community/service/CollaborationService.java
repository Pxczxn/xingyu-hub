package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.CollaborationInviteView;
import top.pxczxn.xingyu.community.dto.CollaborationParticipantView;
import top.pxczxn.xingyu.community.entity.CollaborationInvite;
import top.pxczxn.xingyu.community.entity.CollaborationMember;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CollaborationInviteMapper;
import top.pxczxn.xingyu.community.mapper.CollaborationMemberMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CollaborationService {

    static final String ROLE_EDITOR = "EDITOR";

    private final CollaborationInviteMapper inviteMapper;
    private final CollaborationMemberMapper memberMapper;
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
                "inviterDisplayName", profile == null ? "" : nullToEmpty(profile.getDisplayName()),
                "note", invite.getNote() == null ? "" : invite.getNote(),
                "expiresAt", invite.getExpiresAt().toString());
    }

    @Transactional
    public Map<String, Object> acceptInvite(CommunityUser user, String token) {
        CollaborationInvite invite = inviteMapper.findByToken(token);
        if (invite == null || invite.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.NOT_FOUND, "邀请已失效或不存在");
        }
        if (invite.getInviterId().equals(user.getId())) {
            throw new ContractException(ErrorCode.CONFLICT, "不能接受自己的邀请");
        }

        CollaborationMember existing = memberMapper.findByOwnerAndMember(invite.getInviterId(), user.getId());
        if (existing == null) {
            Instant now = Instant.now();
            CollaborationMember member = new CollaborationMember();
            member.setId(TokenSupport.newId());
            member.setOwnerId(invite.getInviterId());
            member.setMemberId(user.getId());
            member.setRole(ROLE_EDITOR);
            member.setInviteId(invite.getId());
            member.setCreatedAt(now);
            try {
                memberMapper.insert(member);
            } catch (DuplicateKeyException ex) {
                CollaborationMember raced = memberMapper.findByOwnerAndMember(
                        invite.getInviterId(), user.getId());
                if (raced == null) {
                    throw ex;
                }
            }
        }

        var profile = profileMapper.findByUserId(invite.getInviterId());
        return Map.of(
                "accepted", true,
                "inviterUsername", profile == null ? invite.getInviterId() : profile.getUsername(),
                "inviterDisplayName", profile == null ? "" : nullToEmpty(profile.getDisplayName()),
                "note", invite.getNote() == null ? "" : invite.getNote());
    }

    public List<CollaborationParticipantView> listEditors(CommunityUser owner) {
        List<CollaborationMember> rows = memberMapper.listByOwnerId(owner.getId());
        Map<String, CommunityProfile> profiles = profilesByUserId(
                rows.stream().map(CollaborationMember::getMemberId).toList());
        return rows.stream()
                .map(row -> toParticipant(row.getMemberId(), row, profiles))
                .toList();
    }

    public List<CollaborationParticipantView> listHosts(CommunityUser member) {
        List<CollaborationMember> rows = memberMapper.listByMemberId(member.getId());
        Map<String, CommunityProfile> profiles = profilesByUserId(
                rows.stream().map(CollaborationMember::getOwnerId).toList());
        return rows.stream()
                .map(row -> toParticipant(row.getOwnerId(), row, profiles))
                .toList();
    }

    @Transactional
    public void removeEditor(CommunityUser owner, String memberId) {
        if (memberMapper.deleteByOwnerAndMember(owner.getId(), memberId) == 0) {
            throw new ContractException(ErrorCode.NOT_FOUND, "协作者不存在");
        }
    }

    @Transactional
    public void leave(CommunityUser member, String ownerId) {
        if (memberMapper.deleteByOwnerAndMember(ownerId, member.getId()) == 0) {
            throw new ContractException(ErrorCode.NOT_FOUND, "尚未加入该创作");
        }
    }

    private Map<String, CommunityProfile> profilesByUserId(List<String> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return profileMapper.findByUserIds(userIds).stream()
                .collect(Collectors.toMap(CommunityProfile::getUserId, Function.identity(), (left, right) -> left));
    }

    private CollaborationParticipantView toParticipant(
            String userId, CollaborationMember row, Map<String, CommunityProfile> profiles) {
        CommunityProfile profile = profiles.get(userId);
        String username = profile == null || profile.getUsername() == null || profile.getUsername().isBlank()
                ? userId
                : profile.getUsername();
        String displayName = profile == null ? "" : nullToEmpty(profile.getDisplayName());
        return new CollaborationParticipantView(userId, username, displayName, row.getRole(), row.getCreatedAt());
    }

    private CollaborationInviteView toView(CollaborationInvite invite) {
        return new CollaborationInviteView(
                invite.getId(),
                invite.getToken(),
                "/studio/collaboration/accept?token=" + invite.getToken(),
                invite.getNote(),
                invite.getExpiresAt());
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
