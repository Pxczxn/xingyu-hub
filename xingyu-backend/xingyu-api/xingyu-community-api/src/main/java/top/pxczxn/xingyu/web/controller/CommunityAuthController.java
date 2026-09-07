package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.RegisterResponse;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.RecentAuthenticationService;
import top.pxczxn.xingyu.system.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class CommunityAuthController {

    private final CommunityAccountService accountService;
    private final RecentAuthenticationService recentAuthenticationService;
    private final CaptchaService captchaService;

    @PostMapping("/register")
    public RegisterResponse register(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return accountService.register(
                body.get("email"),
                body.get("username"),
                body.get("password"),
                body.get("termsVersion"),
                body.get("phone"),
                body.get("smsCode"),
                body.get("uuid"),
                body.get("code"),
                idempotencyKey);
    }

    @PostMapping("/sms/register")
    public Map<String, Object> sendRegisterSms(@RequestBody Map<String, String> body) {
        return accountService.sendRegisterSmsCode(body.get("phone"));
    }

    @GetMapping("/captcha")
    public Map<String, Object> captcha() {
        return captchaService.generateImageCaptcha();
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            jakarta.servlet.http.HttpServletRequest request) {
        String login = body.get("login") != null ? body.get("login").toString() : null;
        String password = body.get("password") != null ? body.get("password").toString() : null;
        boolean rememberMe = Boolean.TRUE.equals(body.get("rememberMe"));
        String uuid = body.get("uuid") != null ? body.get("uuid").toString() : null;
        String code = body.get("code") != null ? body.get("code").toString() : null;
        String token = accountService.login(
                login, password, rememberMe, uuid, code, userAgent, hashIp(request.getRemoteAddr()));
        return ResponseEntity.ok().header("satoken", token).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "satoken", required = false) String token) {
        accountService.logout(token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email/verify")
    public Map<String, String> verifyEmail(@RequestBody Map<String, String> body) {
        return accountService.verifyEmail(body.get("token"));
    }

    @PostMapping("/email/resend")
    public Map<String, Object> resend(@RequestBody Map<String, String> body) {
        return accountService.resendVerification(body.get("email"));
    }

    @PostMapping("/password-recovery")
    public Map<String, Object> passwordRecovery(@RequestBody Map<String, String> body) {
        return accountService.requestPasswordRecovery(body.get("login"));
    }

    @PostMapping("/password-reset")
    public Map<String, String> passwordReset(@RequestBody Map<String, String> body) {
        return accountService.resetPassword(body.get("token"), body.get("password"));
    }

    @PostMapping("/re-authenticate")
    public Map<String, Object> reAuthenticate(@RequestBody Map<String, String> body) {
        return recentAuthenticationService.reAuthenticate(
                CommunityAuthContext.requireUser(),
                CommunityAuthContext.requireSession(),
                body.get("password"));
    }

    private static String hashIp(String ip) {
        if (ip == null) {
            return null;
        }
        return top.pxczxn.xingyu.community.support.TokenSupport.sha256(ip);
    }
}
