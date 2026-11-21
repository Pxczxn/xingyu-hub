package top.pxczxn.xingyu.community.identity;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserRoleMapper;
import top.pxczxn.xingyu.system.entity.SysRole;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantPort;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantResult;
import top.pxczxn.xingyu.system.mapper.SysRoleMapper;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CommunityAdminGrantService implements CommunityAdminGrantPort {

    private final CommunityUserMapper communityUserMapper;
    private final CommunityUserRoleMapper communityUserRoleMapper;
    private final SysRoleMapper sysRoleMapper;
    private final CommunityIdentityService communityIdentityService;

    @Override
    @Transactional
    public CommunityAdminGrantResult grantExistingByEmail(String email) {
        String normalized = normalizeEmail(email);
        List<CommunityUser> matches = communityUserMapper.findAllByNormalizedEmail(normalized);
        if (matches == null || matches.isEmpty()) {
            throw new IllegalStateException("community account not found");
        }
        if (matches.size() > 1) {
            throw new IllegalStateException("community account email is not unique");
        }
        CommunityUser user = matches.getFirst();
        String communityUserId = user.getId();

        CommunityLoginReadiness readiness = communityIdentityService.evaluateLoginReadiness(communityUserId);
        if (!readiness.allowed()) {
            throw new IllegalStateException("community account is not eligible for admin console: "
                    + readiness.reason());
        }

        SysRole adminRole = requireEnabledAdminRole();
        boolean alreadyGranted = communityUserRoleMapper.countByUserAndRole(communityUserId, adminRole.getId()) > 0;
        if (!alreadyGranted) {
            communityUserRoleMapper.insert(
                    UUID.randomUUID().toString(),
                    communityUserId,
                    adminRole.getId(),
                    java.time.Instant.now());
        }

        AdminConsoleEligibility eligibility =
                communityIdentityService.evaluateAdminConsoleEligibility(communityUserId);
        if (!eligibility.eligible()) {
            throw new IllegalStateException("admin grant did not produce console eligibility");
        }
        return new CommunityAdminGrantResult(communityUserId, alreadyGranted);
    }

    private SysRole requireEnabledAdminRole() {
        List<SysRole> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getCode, AdminConsoleRoleCodes.ADMIN));
        if (roles == null || roles.isEmpty()) {
            throw new IllegalStateException("admin role is missing");
        }
        List<SysRole> enabled = roles.stream()
                .filter(role -> role.getStatus() != null && role.getStatus() == 1)
                .toList();
        if (enabled.isEmpty()) {
            throw new IllegalStateException("admin role is disabled");
        }
        if (enabled.size() > 1) {
            throw new IllegalStateException("admin role is not unique");
        }
        return enabled.getFirst();
    }

    static String normalizeEmail(String email) {
        if (email == null) {
            throw new IllegalStateException("community account email is required");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new IllegalStateException("community account email is required");
        }
        return normalized;
    }
}
