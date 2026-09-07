package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.MeView;
import top.pxczxn.xingyu.community.dto.RegisterResponse;
import top.pxczxn.xingyu.community.dto.SessionView;
import top.pxczxn.xingyu.community.entity.*;
import top.pxczxn.xingyu.community.mapper.AuthSecurityEventMapper;
import top.pxczxn.xingyu.community.mapper.CommunityCreationSpaceMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunitySessionMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.EmailVerificationTokenMapper;
import top.pxczxn.xingyu.community.mapper.RegistrationIdempotencyMapper;
import top.pxczxn.xingyu.community.mapper.ReservedWordMapper;
import top.pxczxn.xingyu.community.mapper.UsernameHistoryMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import top.pxczxn.xingyu.mail.EmailService;
import top.pxczxn.xingyu.sms.SmsServiceFactory;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityAccountService {

    private static final String COMMUNITY_LOGIN_RETRY_KEY = "community:login:retry:";
    private static final String SMS_REGISTER_KEY = "sms:register:";

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9_]{3,32}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final Pattern ROLE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{0,31}$");
    private static final String USER_STATUS_ACTIVE = "ACTIVE";
    private static final String USER_STATUS_PENDING_REVIEW = "PENDING_REVIEW";
    private static final String USER_STATUS_REJECTED = "REJECTED";
    private static final String PURPOSE_REGISTER = "REGISTER";
    private static final String PURPOSE_EMAIL_CHANGE = "EMAIL_CHANGE";
    private static final String PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";

    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
    private final CommunityCreationSpaceMapper spaceMapper;
    private final EmailVerificationTokenMapper tokenMapper;
    private final RegistrationIdempotencyMapper idempotencyMapper;
    private final CommunitySessionMapper sessionMapper;
    private final ReservedWordMapper reservedWordMapper;
    private final UsernameHistoryMapper usernameHistoryMapper;
    private final EmailService emailService;
    private final AuthSecurityEventMapper securityEventMapper;
    private final RecentAuthenticationService recentAuthenticationService;
    private final SystemConfigHelper configHelper;
    private final CaptchaService captchaService;
    private final SmsServiceFactory smsServiceFactory;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public RegisterResponse register(
            String email,
            String username,
            String password,
            String termsVersion,
            String phone,
            String smsCode,
            String captchaUuid,
            String captchaCode,
            String idempotencyKey) {
        if (!configHelper.isRegisterEnabled()) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "系统暂未开放注册");
        }
        validateRegisterCaptcha(captchaUuid, captchaCode);
        String normalizedEmail = normalizeEmail(email);
        String normalizedUsername = normalizeUsername(username);
        String normalizedPhone = normalizePhone(phone);

        RegisterResponse idempotent = loadIdempotentRegisterResponse(idempotencyKey);
        if (idempotent != null) {
            return idempotent;
        }

        validateRegisterInput(normalizedEmail, normalizedUsername, password, termsVersion);
        validateRegisterPhone(normalizedPhone, smsCode);

        CommunityUser existingUser = userMapper.findByEmail(normalizedEmail);
        if (existingUser != null) {
            return antiEnumerateRegisterResponse(existingUser);
        }

        Instant now = Instant.now();
        String userId = TokenSupport.newId();
        CommunityUser user = new CommunityUser();
        user.setId(userId);
        user.setEmail(normalizedEmail);
        if (configHelper.isCommunityPhoneVerificationEnabled()) {
            user.setPhone(normalizedPhone);
            user.setPhoneVerifiedAt(now);
        }
        user.setPasswordHash(PasswordSupport.hash(password));
        user.setStatus(configHelper.isRegisterNeedAudit() ? USER_STATUS_PENDING_REVIEW : USER_STATUS_ACTIVE);
        user.setRole(resolveRegisterRole());
        user.setTermsVersion(termsVersion);
        user.setCreatedAt(now);
        userMapper.insert(user);

        CommunityProfile profile = new CommunityProfile();
        profile.setId(TokenSupport.newId());
        profile.setUserId(userId);
        profile.setUsername(normalizedUsername);
        profile.setDisplayName(normalizedUsername);
        profile.setVisibility("PRIVATE");
        profile.setFollowersVisibility("PRIVATE");
        profile.setLockVersion(0L);
        profile.setCreatedAt(now);
        profileMapper.insert(profile);

        CommunityCreationSpace space = new CommunityCreationSpace();
        space.setId(TokenSupport.newId());
        space.setUserId(userId);
        space.setSlug(normalizedUsername);
        space.setDisplayName(normalizedUsername);
        space.setCreatedAt(now);
        spaceMapper.insert(space);

        boolean mailPending = false;
        if (configHelper.isRegisterVerifyEmail()) {
            mailPending = issueRegisterVerification(user, now);
        }
        sendWelcomeEmailIfConfigured(normalizedEmail, normalizedUsername);
        RegisterResponse response = RegisterResponse.builder()
                .userId(userId)
                .emailVerification(RegisterResponse.EmailVerificationStatus.builder()
                        .status(registerVerificationStatus(user))
                        .canResend(configHelper.isRegisterVerifyEmail() && user.getEmailVerifiedAt() == null)
                        .build())
                .mailPending(mailPending ? true : null)
                .auditStatus(configHelper.isRegisterNeedAudit() ? "PENDING" : null)
                .build();

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            try {
                RegistrationIdempotency record = new RegistrationIdempotency();
                record.setQualifiedKey("register:" + idempotencyKey);
                record.setPayloadHash(TokenSupport.sha256(normalizedEmail + normalizedUsername));
                record.setResponseJson(objectMapper.writeValueAsString(response));
                record.setCreatedAt(now);
                idempotencyMapper.insert(record);
            } catch (Exception ex) {
                log.warn("register idempotency record not saved: {}", ex.getMessage());
            }
        }
        return response;
    }

    private RegisterResponse loadIdempotentRegisterResponse(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return null;
        }
        RegistrationIdempotency existing = idempotencyMapper.selectById("register:" + idempotencyKey);
        if (existing == null) {
            return null;
        }
        try {
            return objectMapper.readValue(existing.getResponseJson(), RegisterResponse.class);
        } catch (Exception ex) {
            log.error("failed to replay register idempotency response", ex);
            throw new ContractException(ErrorCode.INTERNAL_ERROR, "注册请求处理异常，请重试");
        }
    }

    @Transactional
    public String login(
            String login,
            String password,
            boolean rememberMe,
            String captchaUuid,
            String captchaCode,
            String userAgent,
            String ipHash) {
        String normalizedLogin = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
        validateLoginCaptcha(captchaUuid, captchaCode);
        String retryKey = COMMUNITY_LOGIN_RETRY_KEY + normalizedLogin;
        checkCommunityRetryLimit(retryKey);

        CommunityUser user = userMapper.findByEmail(normalizedLogin);
        if (user == null) {
            CommunityProfile profile = profileMapper.findByUsername(normalizedLogin);
            if (profile != null) {
                user = userMapper.selectById(profile.getUserId());
            }
        }
        if (user == null || !PasswordSupport.matches(password, user.getPasswordHash())) {
            incrementCommunityRetry(retryKey);
            int remaining = configHelper.getMaxRetryCount() - getCommunityRetryCount(retryKey);
            if (remaining > 0) {
                throw new ContractException(
                        ErrorCode.AUTH_INVALID_CREDENTIALS,
                        "邮箱或密码错误，还剩" + remaining + "次机会");
            }
            Long ttl = redisTemplate.getExpire(retryKey, TimeUnit.MINUTES);
            throw new ContractException(
                    ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "账号已锁定，请" + (ttl != null && ttl > 0 ? ttl : configHelper.getLockTime()) + "分钟后重试");
        }
        if (!USER_STATUS_ACTIVE.equals(user.getStatus())) {
            if (USER_STATUS_PENDING_REVIEW.equals(user.getStatus())) {
                throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "账号正在审核中，请等待管理员审核通过后再登录");
            }
            if (USER_STATUS_REJECTED.equals(user.getStatus())) {
                throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "注册申请未通过审核，如有疑问请联系管理员");
            }
            throw new ContractException(ErrorCode.ACCOUNT_SUSPENDED);
        }
        if (configHelper.isRegisterVerifyEmail() && user.getEmailVerifiedAt() == null) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "请先完成邮箱验证后再登录");
        }

        redisTemplate.delete(retryKey);
        if (configHelper.isSingleLogin()) {
            revokeActiveSessions(user.getId());
        }
        Instant now = Instant.now();
        boolean persistSession = rememberMe && configHelper.isRememberMeEnabled();
        Instant expiresAt = now.plus(persistSession ? 30 : 1, ChronoUnit.DAYS);
        String token = TokenSupport.newSessionToken();
        CommunitySession session = new CommunitySession();
        session.setId(TokenSupport.newId());
        session.setUserId(user.getId());
        session.setTokenValue(token);
        session.setDeviceLabel(parseDeviceLabel(userAgent));
        session.setUserAgent(truncate(userAgent, 512));
        session.setIpHash(ipHash);
        session.setLastActiveAt(now);
        session.setExpiresAt(expiresAt);
        session.setCreatedAt(now);
        sessionMapper.insert(session);
        return token;
    }

    @Transactional
    public void logout(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return;
        }
        CommunitySession session = sessionMapper.findByTokenValue(tokenValue);
        if (session != null && session.getRevokedAt() == null) {
            session.setRevokedAt(Instant.now());
            sessionMapper.updateById(session);
        }
    }

    public MeView currentUser(CommunityUser user) {
        return MeView.builder()
                .email(user.getEmail())
                .emailVerified(user.getEmailVerifiedAt() != null)
                .build();
    }

    public List<SessionView> listSessions(CommunityUser user, String currentToken) {
        return sessionMapper.listByUserId(user.getId()).stream()
                .map(session -> SessionView.builder()
                        .sessionId(session.getId())
                        .deviceLabel(session.getDeviceLabel() != null ? session.getDeviceLabel() : "未知设备")
                        .lastActiveAt(session.getLastActiveAt().toString())
                        .expiresAt(session.getExpiresAt().toString())
                        .revoked(session.getRevokedAt() != null)
                        .current(session.getTokenValue().equals(currentToken))
                        .build())
                .toList();
    }

    @Transactional
    public void revokeSession(CommunityUser user, String sessionId, String currentToken) {
        CommunitySession session = sessionMapper.selectById(sessionId);
        if (session == null || !user.getId().equals(session.getUserId())) {
            throw new ContractException(ErrorCode.NOT_FOUND, "会话不存在");
        }
        if (session.getRevokedAt() == null) {
            session.setRevokedAt(Instant.now());
            sessionMapper.updateById(session);
        }
    }

    @Transactional
    public void revokeOtherSessions(CommunityUser user, String currentToken) {
        for (CommunitySession session : sessionMapper.listByUserId(user.getId())) {
            if (!session.getTokenValue().equals(currentToken) && session.getRevokedAt() == null) {
                session.setRevokedAt(Instant.now());
                sessionMapper.updateById(session);
            }
        }
    }

    public Map<String, Object> sendRegisterSmsCode(String phone) {
        if (!configHelper.isCommunityPhoneVerificationEnabled()) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "未开启手机验证");
        }
        if (!configHelper.isSmsEnabled()) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "短信服务未启用，请联系管理员");
        }
        String normalizedPhone = normalizePhone(phone);
        if (!PHONE_PATTERN.matcher(normalizedPhone).matches()) {
            throw new FieldContractException("phone", "手机号格式无效");
        }
        if (userMapper.findByPhone(normalizedPhone) != null) {
            throw new FieldContractException("phone", "该手机号已被注册");
        }
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
        redisTemplate.opsForValue().set(SMS_REGISTER_KEY + normalizedPhone, code, 5, TimeUnit.MINUTES);
        boolean sent = smsServiceFactory.sendCode(normalizedPhone, code);
        return Map.of("acknowledged", true, "smsPending", !sent);
    }

    @Transactional
    public Map<String, String> verifyEmail(String rawToken) {
        String tokenHash = TokenSupport.sha256(rawToken);
        EmailVerificationToken token = tokenMapper.findByTokenHashAndPurpose(tokenHash, PURPOSE_REGISTER);
        if (token == null || token.getConsumedAt() != null || token.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        CommunityUser user = userMapper.selectById(token.getUserId());
        if (user == null) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        Instant now = Instant.now();
        user.setEmailVerifiedAt(now);
        userMapper.updateById(user);
        token.setConsumedAt(now);
        tokenMapper.updateById(token);
        return Map.of("status", "VERIFIED");
    }

    @Transactional
    public Map<String, Object> resendVerification(String email) {
        String normalizedEmail = normalizeEmail(email);
        CommunityUser user = userMapper.findByEmail(normalizedEmail);
        if (user == null) {
            return Map.of("acknowledged", true, "mailPending", false);
        }
        if (user.getEmailVerifiedAt() != null) {
            return Map.of("acknowledged", true, "mailPending", false);
        }
        if (!configHelper.isRegisterVerifyEmail()) {
            return Map.of("acknowledged", true, "mailPending", false);
        }
        boolean mailPending = issueRegisterVerification(user, Instant.now());
        return Map.of("acknowledged", true, "mailPending", mailPending);
    }

    @Transactional
    public Map<String, Object> changeEmail(
            CommunityUser user,
            CommunitySession session,
            String recentAuthId,
            String newEmail,
            String password) {
        recentAuthenticationService.requireValidRecentAuth(user, session, recentAuthId);
        String normalizedEmail = normalizeEmail(newEmail);
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new FieldContractException("newEmail", "邮箱格式无效");
        }
        if (!PasswordSupport.matches(password, user.getPasswordHash())) {
            throw new ContractException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        if (normalizedEmail.equals(user.getEmail())) {
            throw new FieldContractException("newEmail", "新邮箱不能与当前邮箱相同");
        }
        if (userMapper.findByEmail(normalizedEmail) != null) {
            throw new FieldContractException("newEmail", "该邮箱不可用");
        }
        boolean mailPending = issueEmailChangeVerification(user, normalizedEmail, Instant.now());
        return Map.of(
                "currentEmail", user.getEmail(),
                "pendingEmail", normalizedEmail,
                "mailPending", mailPending);
    }

    @Transactional
    public Map<String, Object> requestPasswordRecovery(String login) {
        String normalizedLogin = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
        CommunityUser user = userMapper.findByEmail(normalizedLogin);
        if (user == null) {
            CommunityProfile profile = profileMapper.findByUsername(normalizedLogin);
            if (profile != null) {
                user = userMapper.selectById(profile.getUserId());
            }
        }
        boolean mailPending = false;
        String devResetLink = null;
        if (user != null && USER_STATUS_ACTIVE.equals(user.getStatus())) {
            PasswordResetDelivery delivery = issuePasswordReset(user, Instant.now());
            mailPending = delivery.mailPending();
            devResetLink = delivery.devResetLink();
            recordSecurityEvent(user.getId(), "PASSWORD_RECOVERY_REQUESTED", "recovery requested");
        }
        Map<String, Object> response = new HashMap<>();
        response.put("acknowledged", true);
        response.put("mailPending", mailPending);
        if (devResetLink != null) {
            response.put("devResetLink", devResetLink);
        }
        return response;
    }

    @Transactional
    public Map<String, String> resetPassword(String rawToken, String password) {
        validateCommunityPassword(password);
        String tokenHash = TokenSupport.sha256(rawToken);
        EmailVerificationToken token = tokenMapper.findByTokenHashAndPurpose(tokenHash, PURPOSE_PASSWORD_RESET);
        if (token == null || token.getConsumedAt() != null || token.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        CommunityUser user = userMapper.selectById(token.getUserId());
        if (user == null || !USER_STATUS_ACTIVE.equals(user.getStatus())) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        Instant now = Instant.now();
        user.setPasswordHash(PasswordSupport.hash(password));
        userMapper.updateById(user);
        token.setConsumedAt(now);
        tokenMapper.updateById(token);
        revokeActiveSessions(user.getId());
        recordSecurityEvent(user.getId(), "PASSWORD_RESET_COMPLETED", "password reset completed");
        return Map.of("status", "RESET");
    }

    public CommunitySession requireActiveSession(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED);
        }
        CommunitySession session = sessionMapper.findByTokenValue(tokenValue);
        if (session == null || session.getRevokedAt() != null || session.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED);
        }
        CommunityUser user = userMapper.selectById(session.getUserId());
        if (user == null || !USER_STATUS_ACTIVE.equals(user.getStatus())) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED);
        }
        session.setLastActiveAt(Instant.now());
        sessionMapper.updateById(session);
        return session;
    }

    private RegisterResponse antiEnumerateRegisterResponse(CommunityUser user) {
        return RegisterResponse.builder()
                .userId(user.getId())
                .emailVerification(RegisterResponse.EmailVerificationStatus.builder()
                        .status(registerVerificationStatus(user))
                        .canResend(configHelper.isRegisterVerifyEmail() && user.getEmailVerifiedAt() == null)
                        .build())
                .build();
    }

    private String registerVerificationStatus(CommunityUser user) {
        if (!configHelper.isRegisterVerifyEmail()) {
            return "NOT_REQUIRED";
        }
        return user.getEmailVerifiedAt() != null ? "VERIFIED" : "PENDING";
    }

    private boolean issueRegisterVerification(CommunityUser user, Instant now) {
        if (!configHelper.isRegisterVerifyEmail()) {
            return false;
        }
        if (user.getEmailVerifiedAt() != null) {
            return false;
        }
        invalidatePendingTokens(user.getId(), PURPOSE_REGISTER);
        String rawToken = TokenSupport.newVerificationToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setId(TokenSupport.newId());
        token.setUserId(user.getId());
        token.setTokenHash(TokenSupport.sha256(rawToken));
        token.setPurpose(PURPOSE_REGISTER);
        token.setExpiresAt(now.plus(24, ChronoUnit.HOURS));
        token.setCreatedAt(now);
        tokenMapper.insert(token);
        return sendVerificationMail(user.getEmail(), rawToken, "验证你的星语社区邮箱");
    }

    private boolean issueEmailChangeVerification(CommunityUser user, String newEmail, Instant now) {
        invalidatePendingTokens(user.getId(), PURPOSE_EMAIL_CHANGE);
        String rawToken = TokenSupport.newVerificationToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setId(TokenSupport.newId());
        token.setUserId(user.getId());
        token.setTokenHash(TokenSupport.sha256(rawToken));
        token.setPurpose(PURPOSE_EMAIL_CHANGE);
        token.setNewEmail(newEmail);
        token.setExpiresAt(now.plus(24, ChronoUnit.HOURS));
        token.setCreatedAt(now);
        tokenMapper.insert(token);
        return sendVerificationMail(newEmail, rawToken, "确认更换星语社区邮箱");
    }

    private PasswordResetDelivery issuePasswordReset(CommunityUser user, Instant now) {
        invalidatePendingTokens(user.getId(), PURPOSE_PASSWORD_RESET);
        String rawToken = TokenSupport.newVerificationToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setId(TokenSupport.newId());
        token.setUserId(user.getId());
        token.setTokenHash(TokenSupport.sha256(rawToken));
        token.setPurpose(PURPOSE_PASSWORD_RESET);
        token.setExpiresAt(now.plus(1, ChronoUnit.HOURS));
        token.setCreatedAt(now);
        tokenMapper.insert(token);
        return sendPasswordResetMail(user.getEmail(), rawToken);
    }

    private PasswordResetDelivery sendPasswordResetMail(String email, String rawToken) {
        String link = configHelper.getCommunityWebUrl() + "/reset-password?token=" + rawToken;
        try {
            emailService.sendPasswordResetLink(email, link);
            return new PasswordResetDelivery(false, null);
        } catch (Exception ex) {
            log.warn("password reset mail not sent to {}: {}", email, ex.getMessage());
            log.info("dev password reset link for {}: {}", email, link);
            return new PasswordResetDelivery(true, link);
        }
    }

    private record PasswordResetDelivery(boolean mailPending, String devResetLink) {}

    private void recordSecurityEvent(String userId, String eventType, String detail) {
        securityEventMapper.insert(userId, eventType, detail, null, Instant.now());
    }

    private void invalidatePendingTokens(String userId, String purpose) {
        List<EmailVerificationToken> tokens = tokenMapper.selectList(new LambdaQueryWrapper<EmailVerificationToken>()
                .eq(EmailVerificationToken::getUserId, userId)
                .eq(EmailVerificationToken::getPurpose, purpose)
                .isNull(EmailVerificationToken::getConsumedAt));
        Instant now = Instant.now();
        for (EmailVerificationToken token : tokens) {
            token.setConsumedAt(now);
            tokenMapper.updateById(token);
        }
    }

    private boolean sendVerificationMail(String email, String rawToken, String subject) {
        String link = configHelper.getCommunityWebUrl() + "/verify-email?token=" + rawToken + "&email=" + email;
        try {
            emailService.sendEmailVerificationLink(email, link, subject);
            return false;
        } catch (Exception ex) {
            log.warn("verification mail not sent to {}: {}", email, ex.getMessage());
            log.info("dev verification link for {}: {}", email, link);
            return true;
        }
    }

    private void revokeActiveSessions(String userId) {
        Instant now = Instant.now();
        for (CommunitySession session : sessionMapper.listByUserId(userId)) {
            if (session.getRevokedAt() == null) {
                session.setRevokedAt(now);
                sessionMapper.updateById(session);
            }
        }
    }

    private void validateCommunityPassword(String password) {
        try {
            configHelper.validatePassword(password);
        } catch (RuntimeException ex) {
            throw new FieldContractException("password", ex.getMessage());
        }
    }

    private void validateRegisterCaptcha(String uuid, String code) {
        if (!captchaService.requiresImageCaptcha()) {
            return;
        }
        try {
            captchaService.validateImageCaptcha(uuid, code);
        } catch (IllegalArgumentException ex) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, ex.getMessage());
        }
    }

    private void validateRegisterPhone(String phone, String smsCode) {
        if (!configHelper.isCommunityPhoneVerificationEnabled()) {
            return;
        }
        if (phone == null || phone.isBlank()) {
            throw new FieldContractException("phone", "请输入手机号");
        }
        if (!PHONE_PATTERN.matcher(phone).matches()) {
            throw new FieldContractException("phone", "手机号格式无效");
        }
        if (userMapper.findByPhone(phone) != null) {
            throw new FieldContractException("phone", "该手机号已被注册");
        }
        if (smsCode == null || smsCode.isBlank()) {
            throw new FieldContractException("smsCode", "请输入短信验证码");
        }
        String cacheCode = redisTemplate.opsForValue().get(SMS_REGISTER_KEY + phone);
        redisTemplate.delete(SMS_REGISTER_KEY + phone);
        if (cacheCode == null || !cacheCode.equals(smsCode.trim())) {
            throw new FieldContractException("smsCode", "短信验证码错误或已过期");
        }
    }

    private String resolveRegisterRole() {
        String role = configHelper.getRegisterDefaultRole();
        if (role == null || role.isBlank()) {
            return "user";
        }
        String normalized = role.trim().toLowerCase(Locale.ROOT);
        if (!ROLE_PATTERN.matcher(normalized).matches()) {
            return "user";
        }
        return normalized;
    }

    private void sendWelcomeEmailIfConfigured(String email, String username) {
        if (!configHelper.isEmailEnabled()) {
            return;
        }
        try {
            emailService.sendWelcomeEmail(email, username);
        } catch (Exception ex) {
            log.warn("welcome mail not sent to {}: {}", email, ex.getMessage());
        }
    }

    private void validateLoginCaptcha(String uuid, String code) {
        if (!captchaService.requiresImageCaptcha()) {
            return;
        }
        try {
            captchaService.validateImageCaptcha(uuid, code);
        } catch (IllegalArgumentException ex) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, ex.getMessage());
        }
    }

    private void checkCommunityRetryLimit(String retryKey) {
        int retryCount = getCommunityRetryCount(retryKey);
        int maxRetry = configHelper.getMaxRetryCount();
        if (retryCount >= maxRetry) {
            Long ttl = redisTemplate.getExpire(retryKey, TimeUnit.MINUTES);
            throw new ContractException(
                    ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "账号已锁定，请" + (ttl != null && ttl > 0 ? ttl : configHelper.getLockTime()) + "分钟后重试");
        }
    }

    private int getCommunityRetryCount(String retryKey) {
        String str = redisTemplate.opsForValue().get(retryKey);
        return str != null ? Integer.parseInt(str) : 0;
    }

    private void incrementCommunityRetry(String retryKey) {
        int count = getCommunityRetryCount(retryKey) + 1;
        redisTemplate.opsForValue().set(
                retryKey,
                String.valueOf(count),
                configHelper.getLockTime(),
                TimeUnit.MINUTES);
    }

    private void validateRegisterInput(String email, String username, String password, String termsVersion) {
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new FieldContractException("email", "邮箱格式无效");
        }
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new FieldContractException("username", "用户名格式无效");
        }
        validateCommunityPassword(password);
        if (termsVersion == null || termsVersion.isBlank()) {
            throw new FieldContractException("termsVersion", "必须接受协议");
        }
        if (profileMapper.findByUsername(username) != null) {
            throw new FieldContractException("username", "用户名已被占用");
        }
        if (usernameHistoryMapper.findByUsername(username) != null) {
            throw new FieldContractException("username", "用户名已被占用");
        }
        if (spaceMapper.findBySlug(username) != null) {
            throw new FieldContractException("username", "用户名已被占用");
        }
        ReservedWord reserved = reservedWordMapper.selectById(username);
        if (reserved != null && "username".equals(reserved.getCategory())) {
            throw new FieldContractException("username", "用户名不可用");
        }
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizePhone(String phone) {
        return phone == null ? "" : phone.trim();
    }

    private static String parseDeviceLabel(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "未知设备";
        }
        if (userAgent.contains("Mobile")) {
            return "移动设备";
        }
        if (userAgent.contains("Windows")) {
            return "Windows";
        }
        if (userAgent.contains("Mac")) {
            return "macOS";
        }
        return "浏览器";
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    @Transactional
    public void requestAccountDeletion(CommunityUser user) {
        user.setStatus("SUSPENDED");
        userMapper.updateById(user);
    }
}
