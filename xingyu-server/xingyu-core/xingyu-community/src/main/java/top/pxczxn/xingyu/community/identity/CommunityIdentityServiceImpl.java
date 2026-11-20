package top.pxczxn.xingyu.community.identity;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.identity.AdminConsoleIdentityPort;
import top.pxczxn.xingyu.system.identity.AdminConsolePrincipal;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CommunityIdentityServiceImpl implements CommunityIdentityService, AdminConsoleIdentityPort {

    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
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
    public Optional<CommunityIdentityView> findByLogin(String login) {
        CommunityUser user = loadByLogin(login);
        if (user == null) {
            return Optional.empty();
        }
        return Optional.of(CommunityIdentityView.from(user));
    }

    @Override
    public Optional<AdminConsolePrincipal> lookupByLogin(String login) {
        return toPrincipal(loadByLogin(login));
    }

    @Override
    public Optional<AdminConsolePrincipal> lookupById(String communityUserId) {
        return toPrincipal(load(communityUserId));
    }

    @Override
    public CommunityLoginReadiness evaluateLoginReadiness(String communityUserId) {
        return CommunityAccountStatusRules.readiness(load(communityUserId), configHelper.isRegisterVerifyEmail());
    }

    @Override
    public AdminConsoleEligibility evaluateAdminConsoleEligibility(String communityUserId) {
        CommunityLoginReadiness loginReadiness = evaluateLoginReadiness(communityUserId);
        List<String> staffRoleCodes = communityRbacService.listRoleCodes(communityUserId).stream()
                .filter(AdminConsoleRoleCodes::isAllowed)
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

    @Override
    public boolean canLogin(String communityUserId) {
        return evaluateLoginReadiness(communityUserId).allowed();
    }

    @Override
    public String loginBlockedMessage(String communityUserId) {
        return switch (evaluateLoginReadiness(communityUserId).reason()) {
            case PENDING_REVIEW -> "您的账号正在审核中，请等待管理员审核通过后再登录";
            case REJECTED -> "您的注册申请未通过审核，如有疑问请联系管理员";
            case EMAIL_UNVERIFIED -> "请先完成邮箱验证后再登录";
            case SUSPENDED, NOT_FOUND -> "用户已被禁用";
            case NONE -> "";
        };
    }

    @Override
    public boolean canAccessAdminConsole(String communityUserId) {
        return evaluateAdminConsoleEligibility(communityUserId).eligible();
    }

    @Override
    public void requireActive(String communityUserId) {
        if (!canLogin(communityUserId)) {
            String message = loginBlockedMessage(communityUserId);
            throw new BusinessException(403, message == null || message.isBlank() ? "用户已被禁用" : message);
        }
    }

    @Override
    @Transactional
    public void replacePassword(String communityUserId, String rawNewPassword) {
        CommunityUser user = load(communityUserId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setPasswordHash(PasswordSupport.hash(rawNewPassword));
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void updateAdminProfile(
            String communityUserId,
            String displayName,
            String avatar,
            String email,
            String phone) {
        CommunityUser user = load(communityUserId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if (email != null && !email.isBlank()) {
            String normalized = email.trim().toLowerCase(Locale.ROOT);
            CommunityUser existing = userMapper.findByEmail(normalized);
            if (existing != null && !communityUserId.equals(existing.getId())) {
                throw new BusinessException("该邮箱不可用");
            }
            user.setEmail(normalized);
        }
        if (phone != null) {
            String trimmed = phone.trim();
            user.setPhone(trimmed.isEmpty() ? null : trimmed);
        }
        userMapper.updateById(user);

        CommunityProfile profile = profileMapper.findByUserId(communityUserId);
        if (profile == null) {
            throw new BusinessException("用户资料不存在");
        }
        if (displayName != null) {
            String trimmed = displayName.trim();
            profile.setDisplayName(trimmed.isEmpty() ? null : trimmed);
        }
        if (avatar != null) {
            profile.setSettingsJson(ProfileSettingsSupport.putAvatar(profile.getSettingsJson(), avatar));
        }
        profileMapper.updateById(profile);
    }

    @Override
    public String resolveDisplayName(String communityUserId) {
        CommunityProfile profile = profileMapper.findByUserId(communityUserId);
        if (profile != null && profile.getDisplayName() != null && !profile.getDisplayName().isBlank()) {
            return profile.getDisplayName();
        }
        if (profile != null && profile.getUsername() != null && !profile.getUsername().isBlank()) {
            return profile.getUsername();
        }
        CommunityUser user = load(communityUserId);
        return user == null ? communityUserId : user.getEmail();
    }

    private Optional<AdminConsolePrincipal> toPrincipal(CommunityUser user) {
        if (user == null) {
            return Optional.empty();
        }
        CommunityProfile profile = profileMapper.findByUserId(user.getId());
        String username = profile == null ? user.getEmail() : profile.getUsername();
        String displayName = profile == null || profile.getDisplayName() == null || profile.getDisplayName().isBlank()
                ? username
                : profile.getDisplayName();
        String avatar = ProfileSettingsSupport.resolveAvatar(profile);
        return Optional.of(new AdminConsolePrincipal(user.getId(), username, displayName, avatar));
    }

    private CommunityUser loadByLogin(String login) {
        String normalized = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        CommunityUser user = userMapper.findByEmail(normalized);
        if (user != null) {
            return user;
        }
        CommunityProfile profile = profileMapper.findByUsername(normalized);
        if (profile == null) {
            return null;
        }
        return userMapper.selectById(profile.getUserId());
    }

    private CommunityUser load(String communityUserId) {
        if (communityUserId == null || communityUserId.isBlank()) {
            return null;
        }
        return userMapper.selectById(communityUserId);
    }
}
