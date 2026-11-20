package top.pxczxn.xingyu.community.identity;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.helper.RegisterRoleWhitelist;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CommunityIdentityServiceImpl implements CommunityIdentityService {

    private final CommunityUserMapper userMapper;
    private final SystemConfigHelper configHelper;
    private final CommunityRbacService communityRbacService;

    @Override
    public Optional<CommunityIdentityView> findById(String communityUserId) {
        CommunityUser user = load(communityUserId);
        if (user == null) {
            return Optional.empty();
        }
        return Optional.of(CommunityIdentityView.from(user));
    }

    @Override
    public CommunityLoginReadiness evaluateLoginReadiness(String communityUserId) {
        return CommunityAccountStatusRules.readiness(load(communityUserId), configHelper.isRegisterVerifyEmail());
    }

    @Override
    public AdminConsoleEligibility evaluateAdminConsoleEligibility(String communityUserId) {
        CommunityLoginReadiness loginReadiness = evaluateLoginReadiness(communityUserId);
        List<String> staffRoleCodes = communityRbacService.listRoleCodes(communityUserId).stream()
                .filter(code -> !RegisterRoleWhitelist.isOrdinaryCommunityRole(code))
                .toList();
        boolean eligible = loginReadiness.allowed() && !staffRoleCodes.isEmpty();
        return new AdminConsoleEligibility(eligible, loginReadiness, staffRoleCodes);
    }

    @Override
    public boolean passwordMatches(String communityUserId, String rawPassword) {
        CommunityUser user = load(communityUserId);
        if (user == null) {
            return false;
        }
        return PasswordSupport.matches(rawPassword, user.getPasswordHash());
    }

    private CommunityUser load(String communityUserId) {
        if (communityUserId == null || communityUserId.isBlank()) {
            return null;
        }
        return userMapper.selectById(communityUserId);
    }
}
