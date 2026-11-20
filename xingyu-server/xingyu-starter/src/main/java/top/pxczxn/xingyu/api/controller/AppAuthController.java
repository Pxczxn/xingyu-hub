package top.pxczxn.xingyu.api.controller;

import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.auth.LoginRequest;
import top.pxczxn.xingyu.auth.LoginResult;
import top.pxczxn.xingyu.auth.LoginStrategyFactory;
import top.pxczxn.xingyu.auth.enums.ClientType;
import top.pxczxn.xingyu.auth.enums.LoginType;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.service.SysFileService;
import top.pxczxn.xingyu.sms.SmsServiceFactory;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * App/小程序认证 API，路径 /api/v1/app/auth/*。
 */
@RestController
@RequestMapping("/app/auth")
@RequiredArgsConstructor
public class AppAuthController {

    private static final String SMS_CODE_KEY = "sms:login:";

    private final LoginStrategyFactory loginStrategyFactory;
    private final SysUserService userService;
    private final SysFileService fileService;
    private final SystemConfigHelper configHelper;
    private final SmsServiceFactory smsServiceFactory;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/login")
    public Result<LoginResult> login(@RequestBody LoginRequest request) {
        return Result.fail(500, "App 登录已停用，请使用社区账号登录");
    }

    @PostMapping("/sms-code")
    public Result<Void> sendSmsCode(@RequestBody SmsCodeRequest request) {
        String phone = request.getPhone();
        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException("请输入正确的手机号");
        }
        String code = String.valueOf((int) ((Math.random() * 9 + 1) * 100000));
        if (!smsServiceFactory.sendCode(phone, code)) {
            throw new BusinessException("短信发送失败，请稍后重试");
        }
        redisTemplate.opsForValue().set(SMS_CODE_KEY + phone, code, 5, TimeUnit.MINUTES);
        return Result.ok();
    }

    @GetMapping("/profile")
    public Result<SysUser> profile() {
        return Result.fail(500, "App 登录已停用，请使用社区账号登录");
    }

    @PutMapping("/profile")
    public Result<Void> updateProfile(@RequestBody SysUser user) {
        return Result.fail(500, "App 登录已停用，请使用社区账号登录");
    }

    @PostMapping("/password")
    public Result<Void> changePassword(@RequestBody Map<String, String> body) {
        return Result.fail(500, "App 登录已停用，请使用社区账号登录");
    }

    @PostMapping("/logout")
    public Result<Void> logout() {
        StpUtil.logout();
        return Result.ok();
    }

    @PostMapping("/upload-avatar")
    public Result<Map<String, String>> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return Result.fail(500, "App 登录已停用，请使用社区账号登录");
    }

    @Data
    public static class SmsCodeRequest {
        private String phone;
    }
}
