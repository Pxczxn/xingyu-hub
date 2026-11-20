package top.pxczxn.xingyu.auth.strategy;

import top.pxczxn.xingyu.auth.LoginHelper;
import top.pxczxn.xingyu.auth.LoginRequest;
import top.pxczxn.xingyu.auth.LoginResult;
import top.pxczxn.xingyu.auth.LoginStrategy;
import top.pxczxn.xingyu.auth.enums.ClientType;
import top.pxczxn.xingyu.auth.enums.LoginType;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.identity.AdminConsoleIdentityPort;
import top.pxczxn.xingyu.system.identity.AdminConsolePrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * 管理端密码登录：社区账号 + admin 正向授权。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordLoginStrategy implements LoginStrategy {

    private static final String APP_LOGIN_DISABLED = "App 登录已停用，请使用社区账号登录";

    private final AdminConsoleIdentityPort adminConsoleIdentityPort;
    private final SystemConfigHelper configHelper;
    private final StringRedisTemplate redisTemplate;
    private final LoginHelper loginHelper;

    private static final String LOGIN_RETRY_KEY = "login:retry:";
    private static final String CAPTCHA_KEY = "captcha:";

    @Override
    public LoginType getType() {
        return LoginType.PASSWORD;
    }

    @Override
    public ClientType[] supportedClients() {
        return new ClientType[]{ClientType.ADMIN, ClientType.WEB};
    }

    @Override
    public LoginResult login(LoginRequest request) {
        if (request.getClientType() != ClientType.ADMIN) {
            throw new BusinessException(APP_LOGIN_DISABLED);
        }
        validateCaptcha(request);

        String retryKey = LOGIN_RETRY_KEY + request.getUsername();
        checkRetryLimit(retryKey, request.getUsername());

        AdminConsolePrincipal principal = adminConsoleIdentityPort.lookupByLogin(request.getUsername())
                .orElse(null);
        if (principal == null) {
            incrementRetry(retryKey);
            loginHelper.recordFailLog(request.getUsername(), "用户不存在");
            throw new BusinessException("用户名或密码错误");
        }

        if (!adminConsoleIdentityPort.passwordMatches(principal.id(), request.getPassword())) {
            incrementRetry(retryKey);
            loginHelper.recordFailLog(request.getUsername(), "密码错误");
            int remaining = configHelper.getMaxRetryCount() - getRetryCount(retryKey);
            String msg = remaining > 0 ? "用户名或密码错误，还剩" + remaining + "次机会" : "用户名或密码错误，账号已锁定";
            throw new BusinessException(msg);
        }

        if (!adminConsoleIdentityPort.canLogin(principal.id())) {
            loginHelper.recordFailLog(request.getUsername(), "账号状态不允许登录");
            throw new BusinessException(adminConsoleIdentityPort.loginBlockedMessage(principal.id()));
        }

        if (!adminConsoleIdentityPort.canAccessAdminConsole(principal.id())) {
            loginHelper.recordFailLog(request.getUsername(), "非管理端用户，无权登录后台");
            throw new BusinessException("您不是管理端用户，无法登录后台管理系统");
        }

        redisTemplate.delete(retryKey);
        return loginHelper.doLogin(
                principal.id(),
                principal.loginName(),
                principal.displayName(),
                principal.avatar());
    }

    private void validateCaptcha(LoginRequest request) {
        if (!configHelper.isCaptchaEnabled()) return;

        String captchaType = configHelper.getCaptchaType();

        if ("slider".equals(captchaType)) {
            if (!"slider_verified".equals(request.getCode())) {
                throw new BusinessException("请完成滑块验证");
            }
        } else if ("sms".equals(captchaType)) {
            if (request.getPhone() == null || request.getCode() == null) {
                throw new BusinessException("请输入手机号和验证码");
            }
            String cacheCode = redisTemplate.opsForValue().get("sms:login:" + request.getPhone());
            if (cacheCode == null || !cacheCode.equals(request.getCode())) {
                throw new BusinessException("短信验证码错误或已过期");
            }
            redisTemplate.delete("sms:login:" + request.getPhone());
        } else {
            if (request.getUuid() == null || request.getCode() == null) {
                throw new BusinessException("请输入验证码");
            }
            String cacheCode = redisTemplate.opsForValue().get(CAPTCHA_KEY + request.getUuid());
            redisTemplate.delete(CAPTCHA_KEY + request.getUuid());
            if (cacheCode == null || !cacheCode.equalsIgnoreCase(request.getCode())) {
                throw new BusinessException("验证码错误或已过期");
            }
        }
    }

    private void checkRetryLimit(String retryKey, String username) {
        int retryCount = getRetryCount(retryKey);
        int maxRetry = configHelper.getMaxRetryCount();
        if (retryCount >= maxRetry) {
            Long ttl = redisTemplate.getExpire(retryKey, TimeUnit.MINUTES);
            loginHelper.recordFailLog(username, "账号已锁定");
            throw new BusinessException("账号已锁定，请" + ttl + "分钟后重试");
        }
    }

    private int getRetryCount(String retryKey) {
        String str = redisTemplate.opsForValue().get(retryKey);
        return str != null ? Integer.parseInt(str) : 0;
    }

    private void incrementRetry(String retryKey) {
        int count = getRetryCount(retryKey) + 1;
        redisTemplate.opsForValue().set(retryKey, String.valueOf(count),
                configHelper.getLockTime(), TimeUnit.MINUTES);
    }
}
