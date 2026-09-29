package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 社区公开配置（无需登录）
 */
@RestController
@RequestMapping("/public")
@RequiredArgsConstructor
public class CommunityPublicController {

    private final SystemConfigHelper configHelper;
    private final CaptchaService captchaService;

    @GetMapping("/config")
    public Map<String, Object> config() {
        Map<String, Object> registration = new HashMap<>();
        registration.put("enabled", configHelper.isRegisterEnabled());
        registration.put("verifyEmail", configHelper.isRegisterVerifyEmail());
        registration.put("verifyPhone", configHelper.isCommunityPhoneVerificationEnabled());
        registration.put("needAudit", configHelper.isRegisterNeedAudit());
        registration.put("defaultRole", configHelper.getRegisterDefaultRole());
        registration.put("captchaEnabled", captchaService.requiresImageCaptcha());

        Map<String, Object> password = new HashMap<>();
        password.put("minLength", configHelper.getPasswordMinLength());
        password.put("maxLength", configHelper.getPasswordMaxLength());
        password.put("requireUppercase", configHelper.isPasswordRequireUppercase());
        password.put("requireLowercase", configHelper.isPasswordRequireLowercase());
        password.put("requireNumber", configHelper.isPasswordRequireNumber());
        password.put("requireSpecial", configHelper.isPasswordRequireSpecial());

        Map<String, Object> storage = new HashMap<>();
        storage.put("maxSize", configHelper.getStorageMaxSize());
        storage.put("allowTypes", configHelper.getStorageAllowTypes());

        Map<String, Object> login = new HashMap<>();
        login.put("rememberMe", configHelper.isRememberMeEnabled());
        login.put("captchaEnabled", captchaService.requiresImageCaptcha());
        login.put("captchaType", configHelper.getCaptchaType());
        login.put("maxRetryCount", configHelper.getMaxRetryCount());

        Map<String, Object> sms = new HashMap<>();
        sms.put("enabled", configHelper.isSmsEnabled());

        Map<String, Object> result = new HashMap<>();
        result.put("registration", registration);
        result.put("password", password);
        result.put("storage", storage);
        result.put("login", login);
        result.put("sms", sms);
        result.put("siteName", configHelper.getSiteName());
        return result;
    }
}
