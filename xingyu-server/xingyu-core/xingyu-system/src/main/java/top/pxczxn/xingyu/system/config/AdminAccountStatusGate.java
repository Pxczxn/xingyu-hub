package top.pxczxn.xingyu.system.config;

import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 管理端请求上的账号状态检查。
 *
 * <p>角色缓存在 Sa-Token Session 里，禁用账号不会改掉已缓存的 {@code admin}。
 * 这里每次管理请求只读一次当前 {@code sys_user.status}，不替代角色判断，也不注销 Token。
 */
@Component
@RequiredArgsConstructor
public class AdminAccountStatusGate {

    private final SysUserService userService;

    public void requireActive(long userId) {
        SysUser user = userService.getById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(403, "用户已被禁用");
        }
    }
}
