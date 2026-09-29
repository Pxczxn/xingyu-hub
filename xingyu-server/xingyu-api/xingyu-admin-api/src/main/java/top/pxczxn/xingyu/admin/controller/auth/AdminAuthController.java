package top.pxczxn.xingyu.admin.controller.auth;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.captcha.CaptchaUtil;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.ShearCaptcha;
import cn.hutool.captcha.CircleCaptcha;
import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.BCrypt;
import top.pxczxn.xingyu.auth.LoginRequest;
import top.pxczxn.xingyu.auth.LoginResult;
import top.pxczxn.xingyu.auth.LoginStrategyFactory;
import top.pxczxn.xingyu.auth.enums.ClientType;
import top.pxczxn.xingyu.auth.enums.LoginType;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.entity.SysMenu;
import top.pxczxn.xingyu.system.entity.SysRole;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.entity.SysUserRole;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.*;
import top.pxczxn.xingyu.sms.SmsServiceFactory;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 后台认证控制器
 * 登录通过 xingyu-auth 统一策略工厂处理
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final SysUserService userService;
    private final SysMenuService menuService;
    private final SysRoleService roleService;
    private final SysUserRoleService userRoleService;
    private final SystemConfigHelper configHelper;
    private final StringRedisTemplate redisTemplate;
    private final SmsServiceFactory smsServiceFactory;
    private final LoginStrategyFactory loginStrategyFactory;

    private static final String CAPTCHA_KEY = "captcha:";
    private static final String SMS_CODE_KEY = "sms:login:";

    /**
     * 获取验证码
     */
    @GetMapping("/captcha")
    public Result<Map<String, Object>> captcha() {
        String uuid = IdUtil.simpleUUID();
        String captchaType = configHelper.getCaptchaType();
        String code;
        String imageBase64;

        switch (captchaType) {
            case "math":
                cn.hutool.captcha.generator.MathGenerator mathGenerator = new cn.hutool.captcha.generator.MathGenerator(1);
                LineCaptcha mathCaptcha = CaptchaUtil.createLineCaptcha(130, 48);
                mathCaptcha.setGenerator(mathGenerator);
                mathCaptcha.createCode();
                code = mathCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + mathCaptcha.getImageBase64();
                break;
            case "circle":
                CircleCaptcha circleCaptcha = CaptchaUtil.createCircleCaptcha(130, 48, 4, 20);
                code = circleCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + circleCaptcha.getImageBase64();
                break;
            case "shear":
                ShearCaptcha shearCaptcha = CaptchaUtil.createShearCaptcha(130, 48, 4, 4);
                code = shearCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + shearCaptcha.getImageBase64();
                break;
            default:
                LineCaptcha lineCaptcha = CaptchaUtil.createLineCaptcha(130, 48, 4, 50);
                code = lineCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + lineCaptcha.getImageBase64();
        }

        redisTemplate.opsForValue().set(CAPTCHA_KEY + uuid, code.toLowerCase(), 5, TimeUnit.MINUTES);

        Map<String, Object> result = new HashMap<>();
        result.put("uuid", uuid);
        result.put("img", imageBase64);
        return Result.ok(result);
    }

    /**
     * 发送短信验证码
     */
    @PostMapping("/sms-code")
    public Result<Void> sendSmsCode(@RequestBody SmsCodeRequest request) {
        String phone = request.getPhone();
        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException("请输入正确的手机号");
        }

        String limitKey = "sms:limit:" + phone;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(limitKey))) {
            throw new BusinessException("发送太频繁，请稍后再试");
        }

        String code = String.valueOf((int) ((Math.random() * 9 + 1) * 100000));
        boolean success = smsServiceFactory.sendCode(phone, code);
        if (!success) {
            throw new BusinessException("短信发送失败，请稍后重试");
        }

        redisTemplate.opsForValue().set(SMS_CODE_KEY + phone, code, 5, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(limitKey, "1", 60, TimeUnit.SECONDS);
        return Result.ok();
    }

    /**
     * 登录（通过 xingyu-auth 统一策略）
     */
    @PostMapping("/login")
    public Result<LoginResult> login(@RequestBody LoginRequest request) {
        request.setClientType(ClientType.ADMIN);
        if (request.getLoginType() == null) {
            request.setLoginType(LoginType.PASSWORD);
        }
        LoginResult result = loginStrategyFactory.login(request);
        return Result.ok(result);
    }

    /**
     * 退出登录
     */
    @PostMapping("/logout")
    public Result<Void> logout() {
        StpUtil.logout();
        return Result.ok();
    }

    /**
     * 获取当前用户信息
     */
    @GetMapping("/info")
    public Result<Map<String, Object>> info() {
        Long userId = StpUtil.getLoginIdAsLong();
        SysUser user = userService.getDetail(userId);
        List<String> roles = userService.getRoleCodes(userId);
        List<String> permissions = userService.getPermissions(userId);
        List<SysMenu> menus = menuService.getUserMenuTree(userId);

        Map<String, Object> result = new HashMap<>();
        result.put("user", user);
        result.put("roles", roles);
        result.put("permissions", permissions);
        result.put("menus", menus);
        return Result.ok(result);
    }

    /**
     * 获取个人信息
     */
    @GetMapping("/profile")
    public Result<SysUser> profile() {
        Long userId = StpUtil.getLoginIdAsLong();
        return Result.ok(userService.getDetail(userId));
    }

    /**
     * 更新个人信息
     */
    @PutMapping("/profile")
    public Result<Void> updateProfile(@RequestBody SysUser user) {
        Long userId = StpUtil.getLoginIdAsLong();
        userService.updateProfile(userId, user);
        return Result.ok();
    }

    /**
     * 修改密码
     */
    @PostMapping("/password")
    public Result<Void> updatePassword(@RequestBody PasswordRequest request) {
        configHelper.validatePassword(request.getNewPassword());
        Long userId = StpUtil.getLoginIdAsLong();
        userService.updatePassword(userId, request.getOldPassword(), request.getNewPassword());
        return Result.ok();
    }

    /**
     * 用户注册（管理端不支持自助注册，请使用社区前台）
     */
    @PostMapping("/register")
    public Result<?> register(@RequestBody RegisterRequest request) {
        throw new BusinessException("管理端不支持用户注册，请前往社区前台注册");
    }

    @Data
    public static class RegisterRequest {
        private String username;
        private String password;
        private String nickname;
        private String email;
        private String phone;
        private String uuid;
        private String code;
    }

    @Data
    public static class PasswordRequest {
        private String oldPassword;
        private String newPassword;
    }

    @Data
    public static class SmsCodeRequest {
        private String phone;
    }

}
