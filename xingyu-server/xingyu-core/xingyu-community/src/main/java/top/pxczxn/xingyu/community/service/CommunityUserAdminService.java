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
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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
        String normalizedRole = normalizeRole(role);
        long safePage = Math.max(page, 1);
        long safeSize = Math.min(Math.max(pageSize, 1), 100);
        IPage<CommunityUser> pageParam = new Page<>(safePage, safeSize);
        IPage<CommunityUser> paged = userMapper.listForAdmin(pageParam, normalizedStatus, normalizedKeyword, normalizedRole);
        List<CommunityUser> records = paged.getRecords();
        // 一次性批量取回当前页所有 profiles，按 userId 建 Map 后组装，避免逐行 findByUserId 造成 N+1
        Map<String, CommunityProfile> profileByUserId = loadProfilesByUserId(records);
        List<CommunityUserAdminView> views = new ArrayList<>(records.size());
        for (CommunityUser user : records) {
            views.add(toView(user, profileByUserId.get(user.getId())));
        }
        return PageResult.of(views, paged.getTotal(), paged.getCurrent(), paged.getSize());
    }

    /**
     * 管理端按 ID 获取单个社区用户详情，供 deep link（/community/users/:userId）直接打开抽屉使用，
     * 不依赖列表当前分页，且与列表复用同一套 toView 语义。
     */
    public CommunityUserAdminView detail(String userId) {
        CommunityUser user = requireUser(userId);
        return toView(user, profileMapper.findByUserId(userId));
    }

    /**
     * 批量取回给定用户集合的 profiles。pageSize=100 时也只产生 1 条 profile SQL。
     */
    private Map<String, CommunityProfile> loadProfilesByUserId(List<CommunityUser> users) {
        if (users.isEmpty()) {
            return Collections.emptyMap();
        }
        List<String> userIds = users.stream().map(CommunityUser::getId).toList();
        List<CommunityProfile> profiles = profileMapper.findByUserIds(userIds);
        if (profiles.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, CommunityProfile> profileByUserId = new HashMap<>(profiles.size());
        for (CommunityProfile profile : profiles) {
            profileByUserId.put(profile.getUserId(), profile);
        }
        return profileByUserId;
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

    /**
     * role 统一规范为小写，保证 user/USER、creator/CREATOR、admin/ADMIN 语义一致；
     * 与 Mapper 中小写的 <choose> 分支（含 user 覆盖 user/member 及 null/空）保持一致。
     */
    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? null : role.trim().toLowerCase(Locale.ROOT);
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
