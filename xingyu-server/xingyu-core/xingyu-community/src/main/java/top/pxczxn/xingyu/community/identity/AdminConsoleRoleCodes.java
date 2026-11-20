package top.pxczxn.xingyu.community.identity;

import java.util.Locale;
import java.util.Set;

/**
 * 管理端资格的正向角色白名单。未知角色默认拒绝。
 *
 * <p>当前仓库种子与管理端闸门只确认 {@code admin}：
 * {@code sys_role} 种子（V001）仅有 admin/user；
 * {@code SaTokenConfig} 对社区治理域与后台文件路由使用 {@code checkRole("admin")}。
 */
public final class AdminConsoleRoleCodes {

    public static final String ADMIN = "admin";

    private static final Set<String> ALLOWED = Set.of(ADMIN);

    private AdminConsoleRoleCodes() {
    }

    public static boolean isAllowed(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return false;
        }
        return ALLOWED.contains(roleCode.trim().toLowerCase(Locale.ROOT));
    }
}
