package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.concurrency.IdempotencyPolicy;
import top.pxczxn.xingyu.common.contract.concurrency.IdempotencyResult;
import top.pxczxn.xingyu.community.dto.AdminPasswordResetResult;
import top.pxczxn.xingyu.community.dto.LoginResult;
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
import org.springframework.dao.DuplicateKeyException;
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
    private static final String COMMUNITY_MUST_CHANGE_PASSWORD_KEY = "community:must-change-password:";
    private static final String COMMUNITY_ADMIN_TEMP_PASSWORD_KEY = "community:admin-temp-password:";
    private static final int ADMIN_TEMP_PASSWORD_MINUTES = 5;
    private static final String SMS_REGISTER_KEY = "sms:register:";

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9_]{3,32}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final Pattern ROLE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{0,31}$");
    private static final String USER_STATUS_ACTIVE = "ACTIVE";
    private static final String USER_STATUS_PENDING_REVIEW = "PENDING_REVIEW";
    private static final String USER_STATUS_REJECTED = "REJECTED";
    /** 停用（不是删除）。语义与后端 {@code CommunityUserAdminService.STATUS_SUSPENDED} 一致。 */
    private static final String USER_STATUS_SUSPENDED = "SUSPENDED";
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

        // C-2（2026-10-08）：幂等判定必须在**任何业务副作用之前**完成，
        // 且 payload hash 与首次存储使用同一套规范化输入，保证"首次写 / 重放读"语义一致。
        String payloadHash = TokenSupport.sha256(normalizedEmail + '|' + normalizedUsername);
        String qualifiedKey = qualifyIdempotencyKey(idempotencyKey);
        RegisterResponse replayed = replayIfSameIdempotentRequest(qualifiedKey, payloadHash);
        if (replayed != null) {
            return replayed;
        }

        validateRegisterInput(normalizedEmail, normalizedUsername, password, termsVersion);
        validateRegisterPhone(normalizedPhone, smsCode);

        CommunityUser existingUser = userMapper.findByEmail(normalizedEmail);
        if (existingUser != null) {
            return antiEnumerateRegisterResponse(existingUser);
        }

        reserveIdempotencyKey(qualifiedKey, payloadHash, Instant.now());

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

        if (qualifiedKey != null) {
            completeIdempotencyRecord(qualifiedKey, response);
        }
        return response;
    }

    private static final String IDEMPOTENCY_KEY_PREFIX = "register:";

    /** 只对非空幂等键生成合格键；空键返回 null，表示"客户端未启用幂等"。 */
    private String qualifyIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return null;
        }
        return IDEMPOTENCY_KEY_PREFIX + idempotencyKey;
    }

    /**
     * 同 Key + 同 Payload → 返回首次响应；同 Key + 不同 Payload → 409 CONFLICT。
     * 复用 {@link IdempotencyPolicy#resolve}，不自造幂等语义。
     * 仍未完成的占位记录（payload_hash 为空）视为"首个请求还在进行中"，不重放。
     */
    private RegisterResponse replayIfSameIdempotentRequest(String qualifiedKey, String payloadHash) {
        if (qualifiedKey == null) {
            return null;
        }
        RegistrationIdempotency existing = idempotencyMapper.selectById(qualifiedKey);
        if (existing == null || existing.getPayloadHash() == null || existing.getPayloadHash().isBlank()) {
            return null;
        }
        IdempotencyResult<RegisterResponse> decision = IdempotencyPolicy.resolve(
                existing.getPayloadHash(),
                payloadHash,
                deserializeRegisterResponse(existing.getResponseJson()),
                null);
        if (decision.getStatus() == IdempotencyResult.IdempotencyStatus.CONFLICT) {
            throw new ContractException(
                    decision.getErrorCode() == null ? ErrorCode.IDEMPOTENCY_CONFLICT : decision.getErrorCode());
        }
        RegisterResponse replayed = decision.getResponse();
        if (replayed == null) {
            throw new ContractException(ErrorCode.INTERNAL_ERROR, "注册请求处理异常，请重试");
        }
        return replayed;
    }

    /**
     * 在任何业务副作用之前抢占幂等键：插入一条只带 payload_hash 的占位记录。
     *
     * <p>唯一键冲突是**唯一**被识别为幂等冲突信号的情况（并发同 Key 请求的第二者）；
     * 其它 DB 异常一律向上抛，交由全局处理器处理，绝不吞掉。
     * 提交前该事务会一直持有这一行的锁，因此并发同 Key 的第二个请求会在此阻塞，
     * 待第一个提交后读到已完成的记录并走 REPLAYED，而不会产生第二个用户。
     */
    private void reserveIdempotencyKey(String qualifiedKey, String payloadHash, Instant now) {
        if (qualifiedKey == null) {
            return;
        }
        RegistrationIdempotency record = new RegistrationIdempotency();
        record.setQualifiedKey(qualifiedKey);
        record.setPayloadHash(payloadHash);
        record.setResponseJson("");
        record.setCreatedAt(now);
        try {
            idempotencyMapper.insert(record);
        } catch (DuplicateKeyException ex) {
            // 并发同 Key：另一请求已抢到。区分"同载荷"（应重放）与"不同载荷"（应 409）。
            RegistrationIdempotency existing = idempotencyMapper.selectById(qualifiedKey);
            if (existing != null && existing.getPayloadHash() != null
                    && !existing.getPayloadHash().equals(payloadHash)) {
                throw new ContractException(ErrorCode.IDEMPOTENCY_CONFLICT);
            }
            throw new ContractException(ErrorCode.IDEMPOTENCY_CONFLICT);
        }
    }

    private void completeIdempotencyRecord(String qualifiedKey, RegisterResponse response) {
        RegistrationIdempotency record = idempotencyMapper.selectById(qualifiedKey);
        if (record == null) {
            return;
        }
        try {
            record.setResponseJson(objectMapper.writeValueAsString(response));
        } catch (JsonProcessingException ex) {
            log.error("failed to serialize register idempotency response", ex);
            throw new ContractException(ErrorCode.INTERNAL_ERROR, "注册请求处理异常，请重试");
        }
        idempotencyMapper.updateById(record);
    }

    private RegisterResponse deserializeRegisterResponse(String responseJson) {
        try {
            return objectMapper.readValue(responseJson, RegisterResponse.class);
        } catch (Exception ex) {
            log.error("failed to replay register idempotency response", ex);
            throw new ContractException(ErrorCode.INTERNAL_ERROR, "注册请求处理异常，请重试");
        }
    }

    @Transactional
    public LoginResult login(
            String login,
            String password,
            boolean rememberMe,
            String captchaUuid,
            String captchaCode,
            String userAgent,
            String ipHash) {
        String normalizedLogin = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
        // H-1（2026-10-08）：空账号必须在进入 Redis 重试计数之前直接拒绝。
        // 否则 retryKey 会塌缩成 "community:login:retry:"（空后缀），
        // 让"空登录名"共享同一格计数，第 maxRetryCount 次后被锁死。
        if (normalizedLogin.isEmpty()) {
            throw new FieldContractException("login", "请输入账号");
        }
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

        boolean mustChangePassword = requiresPasswordChange(user.getId());
        if (mustChangePassword && !Boolean.TRUE.equals(redisTemplate.hasKey(adminTempPasswordKey(user.getId())))) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "临时密码已过期，请联系管理员重新重置");
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
        return LoginResult.builder().token(token).mustChangePassword(mustChangePassword).build();
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
                .mustChangePassword(requiresPasswordChange(user.getId()))
                .build();
    }

    public boolean requiresPasswordChange(String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(mustChangePasswordKey(userId)));
    }

    @Transactional
    public AdminPasswordResetResult adminResetPassword(String userId) {
        CommunityUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "该用户未绑定邮箱，无法发送临时密码");
        }

        String tempPassword = generateTemporaryPassword();
        user.setPasswordHash(PasswordSupport.hash(tempPassword));
        userMapper.updateById(user);
        revokeActiveSessions(user.getId());

        redisTemplate.opsForValue().set(mustChangePasswordKey(userId), "1");
        redisTemplate.opsForValue().set(
                adminTempPasswordKey(userId), "1", ADMIN_TEMP_PASSWORD_MINUTES, TimeUnit.MINUTES);

        AdminPasswordResetDelivery delivery = sendAdminTempPasswordMail(user.getEmail(), tempPassword);
        recordSecurityEvent(userId, "ADMIN_PASSWORD_RESET", delivery.mailPending()
                ? "管理员发送临时密码（邮件未投递）"
                : "管理员发送临时密码");
        return AdminPasswordResetResult.builder()
                .mailPending(delivery.mailPending())
                .mailError(delivery.mailError())
                .recipientEmail(user.getEmail())
                .tempPassword(tempPassword)
                .build();
    }

    @Transactional
    public void forceChangePassword(CommunityUser user, String newPassword) {
        if (!requiresPasswordChange(user.getId())) {
            throw new ContractException(ErrorCode.VALIDATION_FAILED, "当前账号无需修改密码");
        }
        validateCommunityPassword(newPassword);
        user.setPasswordHash(PasswordSupport.hash(newPassword));
        userMapper.updateById(user);
        redisTemplate.delete(mustChangePasswordKey(user.getId()));
        redisTemplate.delete(adminTempPasswordKey(user.getId()));
        recordSecurityEvent(user.getId(), "PASSWORD_FORCE_CHANGED", "管理员临时密码已更换");
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

    /**
     * 邮箱确认入口（2026-10-08 起按 purpose 严格分流）。
     *
     * <p><b>为什么必须分流</b>：此前本方法硬编码 {@code findByTokenHashAndPurpose(hash, PURPOSE_REGISTER)}，
     * 而换绑流程签发的是 {@code purpose='EMAIL_CHANGE'} 的 token —— 全仓没有任何消费它的代码，
     * 于是「换绑」永远走不完，前端却承诺「完成确认后新邮箱才会生效」（B1 死路）。
     *
     * <p><b>分流怎么做</b>：token_hash 本身是 sha256(rawToken)，不同用途的 rawToken 互不相同，
     * 所以哈希在全局唯一。先用 REGISTER 查、查不到再用 EMAIL_CHANGE 查；两者都查不到才判定无效。
     * 这样 REGISTER 与 EMAIL_CHANGE <b>不可能互相消费对方的 token</b>——不存在「用换绑 token 完成注册验证」
     * 或「用注册 token 完成换绑」的路径。
     *
     * <p><b>信任边界</b>：换绑目标邮箱只取自 {@code token.newEmail}（服务端落库的那一份），
     * <b>绝不读取请求里的任何邮箱参数</b>。确认链接上的 {@code &email=} 只是给用户看的展示提示，
     * 改它不会影响换绑结果。
     *
     * @return REGISTER → {@code {status:"VERIFIED"}}
     *         EMAIL_CHANGE → {@code {status:"EMAIL_CHANGED", email:新邮箱}}
     */
    @Transactional
    public Map<String, String> verifyEmail(String rawToken) {
        String tokenHash = hashTokenOrReject(rawToken);
        EmailVerificationToken token = tokenMapper.findByTokenHashAndPurpose(tokenHash, PURPOSE_REGISTER);
        if (token != null) {
            return consumeRegisterVerification(token);
        }
        token = tokenMapper.findByTokenHashAndPurpose(tokenHash, PURPOSE_EMAIL_CHANGE);
        if (token != null) {
            return consumeEmailChangeVerification(token);
        }
        throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
    }

    /** 注册邮箱验证：置 email_verified_at。 */
    private Map<String, String> consumeRegisterVerification(EmailVerificationToken token) {
        Instant now = Instant.now();
        // 原子消费：并发点击「验证」时只有一个请求能拿到 1，另一个拿到 0 后被判为无效。
        if (tokenMapper.consumeOnce(token.getId(), now) == 0) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        CommunityUser user = userMapper.selectById(token.getUserId());
        if (user == null) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        user.setEmailVerifiedAt(now);
        userMapper.updateById(user);
        return Map.of("status", "VERIFIED");
    }

    /**
     * 邮箱换绑确认：真正把 user.email 改成 {@code token.newEmail}（B1 闭环的核心）。
     *
     * <p><b>换绑后发生什么（明确契约）</b>：
     * <ol>
     *   <li>新邮箱立即成为唯一登录邮箱（DB 唯一键 {@code uk_community_user_email} 保证不会撞他人）；
     *       <b>旧邮箱不能再登录</b>——它已不再是任何用户的 email。</li>
     *   <li>{@code email_verified_at} <b>落到新邮箱上</b>：消费 EMAIL_CHANGE token 本身就是
     *       新邮箱所有权证明（re-auth + token 链接两步），所以确认成功时置
     *       {@code email_verified_at = now}。为什么必须显式写入而不是「保留旧值」：
     *       若账号注册时验证门禁关闭（verified_at 为 NULL），仅保留旧值会让换绑后的
     *       新邮箱依然是「未验证」——门禁一旦开启，用户会被登录处的「请先完成邮箱验证」
     *       拦住（{@code login}），而 token 明明已经证明了所有权。
     *       反方向同样安全：确认前 user.email 仍是旧邮箱、verified_at 指向旧邮箱，
     *       未确认的新地址不会提前继承任何验证状态（确认即变更，无中间态）。</li>
     *   <li><b>撤销全部会话（含当前会话）</b>：换绑是账号级敏感动作，沿用
     *       {@code resetPassword} 的既有先例（同为「凭据变了」而非「权限变了」）。
     *       否则拿到旧邮箱/旧会话的人可以在新邮箱确认后继续以旧身份操作。
     *       前端因此需要在确认后跳回登录页，这一点在 UI 上体现为「确认后需重新登录」。</li>
     * </ol>
     *
     * <p><b>DB 一致性</b>：方法整体 {@code @Transactional}，token 消费与 email 更新同事务同生共死；
     * 唯一键冲突（确认期间他人抢注了新邮箱）捕获 {@link DuplicateKeyException} 转为
     * 业务错误码，不会把数据库异常抛给用户。
     */
    private Map<String, String> consumeEmailChangeVerification(EmailVerificationToken token) {
        String targetEmail = token.getNewEmail();
        // 数据契约兜底：EMAIL_CHANGE token 必须带目标邮箱。缺失说明数据被外部破坏，
        // 按无效处理而不是拿 null 去改 email 列。
        if (targetEmail == null || targetEmail.isBlank()) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        Instant now = Instant.now();
        if (tokenMapper.consumeOnce(token.getId(), now) == 0) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        CommunityUser user = userMapper.selectById(token.getUserId());
        if (user == null || !USER_STATUS_ACTIVE.equals(user.getStatus())) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        // 幂等兜底：目标邮箱就是当前邮箱（例如已确认过、状态回滚等异常路径）。
        // 此时不重复改列，但仍返回成功，避免把「已经是你要的」报成错误。
        if (!targetEmail.equals(user.getEmail())) {
            String previousEmail = user.getEmail();
            user.setEmail(targetEmail);
            try {
                userMapper.updateById(user);
            } catch (DuplicateKeyException ex) {
                // 确认期间该邮箱被他人注册占用。token 已消费 → 这次换绑不会生效，
                // 用户需要重新发起一次申请。
                throw new ContractException(ErrorCode.VALIDATION_FAILED, "该邮箱已被占用，换绑未生效，请重新申请");
            }
            revokeActiveSessions(user.getId());
            recordSecurityEvent(
                    user.getId(), "EMAIL_CHANGED", "email changed from " + previousEmail + " to " + targetEmail);
        }
        // 新邮箱所有权已被本次 token 消费证实：验证状态必须落到新邮箱上。
        // 幂等路径（target == current）也照写——该路径同样证明了这封邮箱的所有权。
        user.setEmailVerifiedAt(now);
        userMapper.updateById(user);
        return Map.of("status", "EMAIL_CHANGED", "email", targetEmail);
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

    /**
     * 申请邮箱换绑（2026-10-08 起是真正可完成闭环的第一步）。
     *
     * <p><b>校验顺序（刻意如此）</b>：先 re-auth grant，再密码，再格式/重复/占用。
     * grant 校验在密码之前，是为了让「没有新鲜再认证凭证」这一条独立失败——
     * 测试要能证明「有登录态但无有效 grant」时本操作被拒绝，而不是被后面的密码错误顶掉。
     *
     * <p><b>并发确定性</b>：对 user 行加 {@code FOR UPDATE} 锁后再作废旧 token、插入新 token。
     * 于是同一用户的并发申请被串行化，<b>最后一个申请作废前面所有申请</b>，
     * 任一时刻至多一条有效待确认 token —— 用户点哪个确认链接都不会「意外生效」。
     *
     * <p><b>行锁必须是本方法的第一条 SQL 语句</b>（2026-10-08 修正的真实缺陷）。
     * 本方法在 {@code REPEATABLE READ} 下，RR 快照在事务中<b>第一条普通 SELECT</b> 时就建立了。
     * 行锁若排在 grant 校验（普通 SELECT）之后，并发场景下后到的请求虽然正确等到了锁，
     * 但它此后的 {@code invalidatePendingTokens} 读的仍是<b>旧快照</b>，看不到前一个请求
     * 刚插入的 token，于是不会把它作废 —— 实测 4 个并发申请会留下 4 条有效 token。
     * 把 {@code FOR UPDATE} 提到最前面后，锁的等待发生在快照建立之前，
     * 拿到锁时快照才被创建，因此能看到前序事务的提交。这与本仓库消息域
     * 「{@code lockForUpdate} 必须是第一条语句」是同一条纪律。
     *
     * <p><b>占用校验不能替代唯一键</b>：{@code findByEmail} 只是尽力检查，
     * 确认链接被点开时新邮箱可能已被他人注册，所以真正的保证是确认时捕获
     * {@link DuplicateKeyException}（见 {@link #consumeEmailChangeVerification}）。
     */
    @Transactional
    public Map<String, Object> changeEmail(
            CommunityUser user,
            CommunitySession session,
            String recentAuthId,
            String newEmail,
            String password) {
        // 必须先加锁：见方法注释「行锁必须是本方法的第一条 SQL 语句」。
        CommunityUser locked = userMapper.findByIdForUpdate(user.getId());
        if (locked == null) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED);
        }
        recentAuthenticationService.requireValidRecentAuth(user, session, recentAuthId);
        String normalizedEmail = normalizeEmail(newEmail);
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new FieldContractException("newEmail", "邮箱格式无效");
        }
        if (!PasswordSupport.matches(password, locked.getPasswordHash())) {
            throw new ContractException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        if (!USER_STATUS_ACTIVE.equals(locked.getStatus())) {
            throw new ContractException(ErrorCode.ACCOUNT_SUSPENDED);
        }
        if (normalizedEmail.equals(locked.getEmail())) {
            throw new FieldContractException("newEmail", "新邮箱不能与当前邮箱相同");
        }
        if (userMapper.findByEmail(normalizedEmail) != null) {
            throw new FieldContractException("newEmail", "该邮箱不可用");
        }
        boolean mailPending = issueEmailChangeVerification(locked, normalizedEmail, Instant.now());
        return Map.of(
                "currentEmail", locked.getEmail(),
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
        String tokenHash = hashTokenOrReject(rawToken);
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

    /**
     * 该账号是否处于<b>可参与社区交互</b>的状态（2026-10-06 新增）。
     *
     * <p>存在的理由：登录时用 {@code USER_STATUS_ACTIVE} 拦了一次，但那只管<b>本人登录</b>。
     * 停用 / 审核中 / 被拒的用户，其余人此前仍能给他发私信（实测 {@code openDirect} 200、
     * 消息照写库），而他自己登不进来 —— 消息进了一个没人读得走的会话。
     *
     * <p>所以把「ACTIVE 才算能参与」这条规则提到这里，成为<b>唯一</b>事实源：调用方
     * （私信、关注等）只问「能不能参与」，不自己再写一套 {@code isSuspended}。判定本身
     * 仍然只用既有的 {@code USER_STATUS_ACTIVE}，没有引入新的状态词汇。
     */
    public boolean canParticipate(CommunityUser user) {
        return user != null && USER_STATUS_ACTIVE.equals(user.getStatus());
    }

    /**
     * 同 {@link #canParticipate}，但不可参与时抛错。错误码与登录时一致
     * （{@code ACCOUNT_SUSPENDED} = 403「账号已停用」），避免同一个原因在前端出现两种说法。
     */
    public void requireCanParticipate(CommunityUser user) {
        if (canParticipate(user)) {
            return;
        }
        if (USER_STATUS_PENDING_REVIEW.equals(user == null ? null : user.getStatus())) {
            throw new ContractException(ErrorCode.ACCOUNT_SUSPENDED, "对方账号正在审核中，暂时无法私信");
        }
        throw new ContractException(ErrorCode.ACCOUNT_SUSPENDED, "对方账号已停用，无法私信");
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

    private AdminPasswordResetDelivery sendAdminTempPasswordMail(String email, String tempPassword) {
        try {
            emailService.sendResetPassword(email, tempPassword, ADMIN_TEMP_PASSWORD_MINUTES);
            log.info("admin temp password mail accepted by SMTP for {}", email);
            return new AdminPasswordResetDelivery(false, null);
        } catch (Exception ex) {
            log.warn("admin temp password mail not sent to {}: {}", email, ex.getMessage());
            log.info("dev admin temp password for {}: {}", email, tempPassword);
            return new AdminPasswordResetDelivery(true, summarizeMailError(ex));
        }
    }

    private static String summarizeMailError(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return "邮件发送失败";
        }
        String normalized = message.replaceAll("\\s+", " ").trim();
        return normalized.length() > 180 ? normalized.substring(0, 180) + "…" : normalized;
    }

    private record PasswordResetDelivery(boolean mailPending, String devResetLink) {}

    private record AdminPasswordResetDelivery(boolean mailPending, String mailError) {}

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

    private String mustChangePasswordKey(String userId) {
        return COMMUNITY_MUST_CHANGE_PASSWORD_KEY + userId;
    }

    private String adminTempPasswordKey(String userId) {
        return COMMUNITY_ADMIN_TEMP_PASSWORD_KEY + userId;
    }

    private String generateTemporaryPassword() {
        int minLen = Math.max(configHelper.getPasswordMinLength(), 12);
        int maxLen = configHelper.getPasswordMaxLength();
        int targetLen = Math.min(Math.max(minLen, 12), maxLen);
        StringBuilder password = new StringBuilder();
        if (configHelper.isPasswordRequireUppercase()) {
            password.append(randomPasswordChar("ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
        }
        if (configHelper.isPasswordRequireLowercase()) {
            password.append(randomPasswordChar("abcdefghijklmnopqrstuvwxyz"));
        }
        if (configHelper.isPasswordRequireNumber()) {
            password.append(randomPasswordChar("0123456789"));
        }
        if (configHelper.isPasswordRequireSpecial()) {
            password.append(randomPasswordChar("!@#$%^&*"));
        }
        String allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        while (password.length() < targetLen) {
            password.append(randomPasswordChar(allChars));
        }
        return password.toString();
    }

    private char randomPasswordChar(String alphabet) {
        return alphabet.charAt(ThreadLocalRandom.current().nextInt(alphabet.length()));
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

    /**
     * 校验并摘要一个外部传入的验证/重置凭据（C-1 修复，2026-10-08）。
     *
     * <p>必须在 {@link TokenSupport#sha256(String)} 之前完成参数校验：该方法对 null
     * 会抛 NPE，被兜底 {@code Exception} 分支映射成 500「系统繁忙」，把一次
     * 「输入缺失」误报成服务端故障。
     *
     * <p>语义：任何"没有可用的 token 文本"（null / 空串 / 全空白）一律等价于
     * 「验证链接无效或已过期」，返回领域定义的 400 {@code EMAIL_TOKEN_INVALID}，
     * 且不进入 sha256、不泄漏异常堆栈。
     * 与"格式错误 / 已过期 / 已使用"的 token 走**同一条**领域错误，避免把
     * 「输入缺失」和「token 失效」拆成两套对外契约。
     */
    private String hashTokenOrReject(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ContractException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        return TokenSupport.sha256(rawToken);
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

    /**
     * 停用账号（<b>不是删除，也不是匿名化</b>）。
     *
     * <p><b>语义边界（2026-10-08 复核并明示）</b>：本方法<b>只</b>把 {@code user.status} 置为
     * {@code SUSPENDED}。文章、评论、动态、私信、收藏、关注关系<b>一律原样保留</b>，
     * 全仓没有任何擦除或匿名化逻辑，也不存在定时清理任务。请勿在任何文案里把它描述成「删除」。
     *
     * <p><b>停用后立即失效的东西（不需要主动撤销，靠鉴权时查状态）</b>：
     * <ul>
     *   <li>无法登录（{@code login} 检查 {@code USER_STATUS_ACTIVE}）；</li>
     *   <li>所有会话立即 401（{@code requireActiveSession} 检查同一状态）——含其他设备；</li>
     *   <li>已发行的 API Token 一律拒绝（{@code requireActiveToken} 同样检查，
     *       本轮补上——此前这条路径<b>不</b>查账号状态，是真实漏洞）。</li>
     * </ul>
     * 之所以用「鉴权时查」而不是「停用时批量撤销」，是因为账号状态是唯一事实源：
     * 再维护一份「已撤销 token 名单」就多一处可能漏同步的状态。
     *
     * <p><b>安全加固（2026-10-08）</b>：原实现只有两行，任何持有登录态的人都能直接 POST 停用，
     * 无需证明自己知道密码。现在要求<b>新鲜的 re-auth grant 且必须一次性消费</b>
     * （{@code requireAndConsumeRecentAuth}）——grant 15 分钟过期、单次使用、
     * 绑定 userId + sessionId，所以 CSRF 或 XSS 拿到一个长期会话也无法停用账号。
     *
     * <p><b>幂等</b>：已是 {@code SUSPENDED} 时直接返回，不重复写库、不重复记事件；
     * 这样客户端重试不会产生第二条安全事件日志。
     */
    @Transactional
    public void requestAccountDeletion(
            CommunityUser user, CommunitySession session, String recentAuthId) {
        if (USER_STATUS_SUSPENDED.equals(user.getStatus())) {
            // 已经停用：grant 仍然要求有效（保持"高风险操作一律先再认证"的统一语义），
            // 但不再重复改状态。
            recentAuthenticationService.requireValidRecentAuth(user, session, recentAuthId);
            return;
        }
        recentAuthenticationService.requireAndConsumeRecentAuth(user, session, recentAuthId);
        user.setStatus(USER_STATUS_SUSPENDED);
        userMapper.updateById(user);
        recordSecurityEvent(user.getId(), "ACCOUNT_DEACTIVATED", "account deactivated by owner");
    }
}
