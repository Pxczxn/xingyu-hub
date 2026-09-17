package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.community.dto.AdminPasswordResetResult;
import top.pxczxn.xingyu.community.dto.CommunityUserAdminView;
import top.pxczxn.xingyu.community.dto.CommunityUserStatistics;
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
    private static final String STATUS_SUSPENDED = "SUSPENDED";

    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
    private final CommunityAccountService accountService;

    public PageResult<CommunityUserAdminView> list(
            long page,
            long pageSize,
            String status,
            String keyword,
            String role) {
        String normalizedStatus = status == null || status.isBlank()
                ? null
                : status.trim().toUpperCase(Locale.ROOT);
        String normalizedKeyword = normalizeSearchValue(keyword);
        String normalizedRole = normalizeSearchValue(role);
        long safePage = Math.max(page, 1);
        long safeSize = Math.min(Math.max(pageSize, 1), 100);
        IPage<CommunityUser> pageParam = new Page<>(safePage, safeSize);
        IPage<CommunityUser> paged = userMapper.listForAdmin(pageParam, normalizedStatus, normalizedKeyword, normalizedRole);
        List<CommunityUserAdminView> views = new ArrayList<>(paged.getRecords().size());
        for (CommunityUser user : paged.getRecords()) {
            CommunityProfile profile = profileMapper.findByUserId(user.getId());
            views.add(toView(user, profile));
        }
        return PageResult.of(views, paged.getTotal(), paged.getCurrent(), paged.getSize());
    }

    /**
     * 社区用户全局概览统计，不跟随 page/pageSize/keyword/status/role 变化，
     * 避免“搜索一个用户后用户总数变成 1”这类语义错误。
     */
    public CommunityUserStatistics statistics() {
        long totalUsers = userMapper.selectCount(new LambdaQueryWrapper<CommunityUser>());
        long pendingReview = countByStatus(STATUS_PENDING_REVIEW);
        long active = countByStatus(STATUS_ACTIVE);
        long attention = userMapper.selectCount(
                new LambdaQueryWrapper<CommunityUser>()
                        .in(CommunityUser::getStatus, STATUS_REJECTED, STATUS_SUSPENDED));
        return CommunityUserStatistics.of(totalUsers, pendingReview, active, attention);
    }

    private long countByStatus(String status) {
        return userMapper.selectCount(new LambdaQueryWrapper<CommunityUser>().eq(CommunityUser::getStatus, status));
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

    public AdminPasswordResetResult resetPassword(String userId) {
        return accountService.adminResetPassword(userId);
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
