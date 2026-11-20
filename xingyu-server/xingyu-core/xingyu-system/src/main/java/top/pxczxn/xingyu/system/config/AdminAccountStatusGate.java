package top.pxczxn.xingyu.system.config;

import top.pxczxn.xingyu.system.identity.AdminConsoleIdentityPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 管理端请求上的账号状态检查。
 *
 * <p>角色缓存在 Sa-Token Session 里，禁用账号不会改掉已缓存的 {@code admin}。
 * 每次管理请求读取当前社区账号状态，不替代角色判断，也不注销 Token。
 */
@Component
@RequiredArgsConstructor
public class AdminAccountStatusGate {

    private final AdminConsoleIdentityPort adminConsoleIdentityPort;

    public void requireActive(String communityUserId) {
        adminConsoleIdentityPort.requireActive(communityUserId);
    }
}
