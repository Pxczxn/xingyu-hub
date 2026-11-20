package top.pxczxn.xingyu.system.helper;

import top.pxczxn.xingyu.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;

import java.util.Locale;
import java.util.Set;

/**
 * 社区注册默认角色白名单。
 *
 * <p>只允许普通社区角色写入注册配置、落到新账号。后台特权角色不得通过注册获得。
 */
@Slf4j
public final class RegisterRoleWhitelist {

    public static final String FALLBACK_ROLE = "user";

    static final Set<String> ALLOWED = Set.of("user", "member", "creator");

    private RegisterRoleWhitelist() {
    }

    /**
     * 将配置值规范为可授予的注册角色。缺失、空白、大小写异常或未授权值一律回落 {@link #FALLBACK_ROLE}。
     */
    public static String normalizeOrFallback(String raw) {
        if (raw == null || raw.isBlank()) {
            return FALLBACK_ROLE;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        if (ALLOWED.contains(normalized)) {
            return normalized;
        }
        log.warn("register.defaultRole is not an allowed community role; falling back to {}", FALLBACK_ROLE);
        return FALLBACK_ROLE;
    }

    /**
     * 保存注册配置时：缺省或空白表示沿用回落，不写特权角色；其它值必须在白名单内。
     */
    public static void requireAllowedForSave(String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        if (ALLOWED.contains(normalized)) {
            return;
        }
        throw new BusinessException(400, "注册默认角色仅允许 user、member、creator");
    }
}
