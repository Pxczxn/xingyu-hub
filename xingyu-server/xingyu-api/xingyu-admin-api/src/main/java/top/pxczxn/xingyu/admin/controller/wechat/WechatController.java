package top.pxczxn.xingyu.admin.controller.wechat;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.wechat.WechatMiniProgramService;
import top.pxczxn.xingyu.wechat.WechatMpService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 微信开放能力，路径 /api/v1/admin/wechat/*。
 */
@RestController
@RequestMapping("/wechat")
@RequiredArgsConstructor
public class WechatController {

    private final WechatMiniProgramService miniProgramService;
    private final WechatMpService mpService;

    @PostMapping("/miniprogram/login")
    public Result<WechatMiniProgramService.MiniProgramLoginResult> miniProgramLogin(@RequestBody CodeRequest request) {
        return Result.ok(miniProgramService.login(request.getCode()));
    }

    @PostMapping("/miniprogram/phone")
    public Result<Map<String, String>> miniProgramPhone(@RequestBody CodeRequest request) {
        return Result.ok(Map.of("phone", miniProgramService.getPhoneNumber(request.getCode())));
    }

    @GetMapping("/mp/oauth-url")
    public Result<String> oauthUrl(
            @RequestParam String redirectUri,
            @RequestParam(required = false, defaultValue = "") String state,
            @RequestParam(required = false, defaultValue = "snsapi_userinfo") String scope) {
        return Result.ok(mpService.getOAuthUrl(redirectUri, state, scope));
    }

    @PostMapping("/mp/oauth-login")
    public Result<WechatMpService.MpOAuthResult> mpOAuthLogin(@RequestBody CodeRequest request) {
        return Result.ok(mpService.oauthLogin(request.getCode()));
    }

    @PostMapping("/mp/menu/sync")
    public Result<Void> syncMenu(@RequestBody MenuSyncRequest request) {
        mpService.createMenu(request.getMenuConfig());
        return Result.ok();
    }

    @GetMapping("/mp/menu")
    public Result<String> getMenu() {
        return Result.ok(mpService.getMenu());
    }

    @DeleteMapping("/mp/menu")
    public Result<Void> deleteMenu() {
        mpService.deleteMenu();
        return Result.ok();
    }

    @Data
    public static class CodeRequest {
        private String code;
    }

    @Data
    public static class MenuSyncRequest {
        private String menuConfig;
    }
}
