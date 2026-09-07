package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.CommunityUserAdminView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CommunityUserAdminService {

    private static final String STATUS_PENDING_REVIEW = "PENDING_REVIEW";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_REJECTED = "REJECTED";

    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;

    public List<CommunityUserAdminView> list(
            String status,
            String username,
            String email,
            String phone,
            String keyword,
            int limit) {
        String normalizedStatus = status == null || status.isBlank()
                ? null
                : status.trim().toUpperCase(Locale.ROOT);
        String normalizedUsername = normalizeSearchValue(username);
        String normalizedEmail = normalizeSearchValue(email);
        String normalizedPhone = normalizeSearchValue(phone);
        String normalizedKeyword = normalizeSearchValue(keyword);
        int boundedLimit = Math.min(Math.max(limit, 1), 200);
        List<CommunityUser> users = userMapper.listForAdmin(
                normalizedStatus,
                normalizedUsername,
                normalizedEmail,
                normalizedPhone,
                normalizedKeyword,
                boundedLimit);
        List<CommunityUserAdminView> result = new ArrayList<>(users.size());
        for (CommunityUser user : users) {
            CommunityProfile profile = profileMapper.findByUserId(user.getId());
            result.add(toView(user, profile));
        }
        return result;
    }

    @Transactional
    public void approve(String userId) {
        CommunityUser user = requireUser(userId);
        if (!STATUS_PENDING_REVIEW.equals(user.getStatus())) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "该用户不在待审核状态");
        }
        user.setStatus(STATUS_ACTIVE);
        userMapper.updateById(user);
    }

    @Transactional
    public void reject(String userId) {
        CommunityUser user = requireUser(userId);
        if (!STATUS_PENDING_REVIEW.equals(user.getStatus())) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "该用户不在待审核状态");
        }
        user.setStatus(STATUS_REJECTED);
        userMapper.updateById(user);
    }

    private CommunityUser requireUser(String userId) {
        CommunityUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private static String normalizeSearchValue(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private CommunityUserAdminView toView(CommunityUser user, CommunityProfile profile) {
        return CommunityUserAdminView.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(profile != null ? profile.getUsername() : null)
                .displayName(profile != null ? profile.getDisplayName() : null)
                .phone(user.getPhone())
                .status(user.getStatus())
                .role(user.getRole())
                .emailVerified(user.getEmailVerifiedAt() != null)
                .phoneVerified(user.getPhoneVerifiedAt() != null)
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                .build();
    }
}
