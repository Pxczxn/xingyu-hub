package top.pxczxn.xingyu.auth;

import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysLoginLogService;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.util.IpUtils;
import cn.hutool.http.useragent.UserAgent;
import cn.hutool.http.useragent.UserAgentUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 登录辅助工具
 * 提供登录后的公共逻辑：Token生成、Session写入、日志记录
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginHelper {

    private final SysLoginLogService loginLogService;
    private final SystemConfigHelper configHelper;

    /**
     * 社区 UUID 登录（管理端日常身份）。
     */
    public LoginResult doLogin(String loginId, String loginName, String nickname, String avatar) {
        RequestInfo info = getRequestInfo();

        if (configHelper.isSingleLogin()) {
            StpUtil.logout(loginId);
        }

        StpUtil.login(loginId);

        SaSession session = StpUtil.getSession();
        session.set("loginName", loginName);
        session.set("ipaddr", info.ip);
        session.set("loginLocation", IpUtils.getAddressByIp(info.ip));
        session.set("browser", info.browser);
        session.set("os", info.os);
        session.set("status", 1);
        session.set("loginTime", System.currentTimeMillis());

        loginLogService.recordLog(loginName, 0, "登录成功", info.ip, info.browser, info.os);

        return LoginResult.of(
                StpUtil.getTokenValue(),
                loginId,
                loginName,
                nickname,
                avatar
        );
    }

    /**
     * 历史 sys_user 登录入口。管理端日常认证不再调用。
     */
    public LoginResult doLogin(SysUser user) {
        return doLogin(
                String.valueOf(user.getId()),
                user.getUsername(),
                user.getNickname(),
                user.getAvatar());
    }

    /**
     * 记录登录失败日志
     */
    public void recordFailLog(String username, String message) {
        RequestInfo info = getRequestInfo();
        loginLogService.recordLog(username, 1, message, info.ip, info.browser, info.os);
    }

    /**
     * 提取当前请求的 IP、浏览器、操作系统信息
     */
    private RequestInfo getRequestInfo() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attrs != null ? attrs.getRequest() : null;
        String ip = IpUtils.getIpAddr(request);
        UserAgent ua = request != null ? UserAgentUtil.parse(request.getHeader("User-Agent")) : null;
        String browser = ua != null ? ua.getBrowser().getName() : "Unknown";
        String os = ua != null ? ua.getOs().getName() : "Unknown";
        return new RequestInfo(ip, browser, os);
    }

    /**
     * 请求信息
     */
    private record RequestInfo(String ip, String browser, String os) {}
}
