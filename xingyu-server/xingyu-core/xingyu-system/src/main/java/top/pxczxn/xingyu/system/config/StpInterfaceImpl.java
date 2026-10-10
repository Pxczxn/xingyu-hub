package top.pxczxn.xingyu.system.config;

import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.stp.StpInterface;
import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Sa-Token权限认证实现
 * 使用 SaSession 缓存权限和角色数据，避免每次请求都查询数据库
 * 缓存生命周期与用户会话一致，会话过期时自动清除
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StpInterfaceImpl implements StpInterface {

    private final SysUserService userService;

    private static final String CACHE_KEY_PERMISSIONS = "user_permissions";
    private static final String CACHE_KEY_ROLES = "user_roles";

    /**
     * 无任何权限/角色的账号返回的哨兵编码。
     *
     * <p>⚠️ 2026-10-10（Admin Effective Permission & Coverage Closure）：实测发现
     * 【无角色账号 + Redis Session 中已缓存的空权限列表】会绕过 @SaCheckPermission/
     * @SaCheckRole —— 缓存命中路径下空列表匹配确定失败本应 403，实测却放行
     * （sa-token 1.37 对空集合的边界行为，role page 对 0 角色账号返回 200 的根因）。
     * 返回一个不可能匹配任何真实权限/角色编码的哨兵值，使拒绝确定发生。
     * 真实编码均为 {@code module:action} 格式（sys:user:list 等），不会与哨兵冲突。
     */
    private static final String DENY_SENTINEL = "__DENY__";

    private static List<String> denyIfEmpty(List<String> values) {
        return (values == null || values.isEmpty()) ? List.of(DENY_SENTINEL) : values;
    }

    /**
     * 获取权限列表（优先从 Session 缓存读取）
     */
    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        SaSession session = StpUtil.getSessionByLoginId(loginId);
        return denyIfEmpty(session.get(CACHE_KEY_PERMISSIONS, () -> {
            log.debug("从数据库加载用户权限: userId={}", loginId);
            return userService.getPermissions(Long.parseLong(loginId.toString()));
        }));
    }

    /**
     * 获取角色列表（优先从 Session 缓存读取）
     */
    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        SaSession session = StpUtil.getSessionByLoginId(loginId);
        return denyIfEmpty(session.get(CACHE_KEY_ROLES, () -> {
            log.debug("从数据库加载用户角色: userId={}", loginId);
            return userService.getRoleCodes(Long.parseLong(loginId.toString()));
        }));
    }

    /**
     * 清除指定用户的权限和角色缓存
     * 在用户角色变更、角色权限变更时调用
     */
    public static void clearPermissionCache(Long userId) {
        try {
            SaSession session = StpUtil.getSessionByLoginId(userId, false);
            if (session != null) {
                session.delete(CACHE_KEY_PERMISSIONS);
                session.delete(CACHE_KEY_ROLES);
                log.debug("已清除用户权限缓存: userId={}", userId);
            }
        } catch (Exception e) {
            // 用户未登录时获取不到session，忽略即可
        }
    }
}
