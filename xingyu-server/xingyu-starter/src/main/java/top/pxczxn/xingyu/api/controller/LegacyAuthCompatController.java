package top.pxczxn.xingyu.api.controller;

import top.pxczxn.xingyu.common.result.Result;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 旧 uniapp 管理端身份入口已停用，避免 UUID 会话走 getLoginIdAsLong。
 */
@RestController
@RequestMapping("/auth")
public class LegacyAuthCompatController {

    private static final String DISABLED = "该登录入口已停用，请使用社区账号登录";

    @GetMapping("/info")
    public Result<Map<String, Object>> info() {
        return Result.fail(500, DISABLED);
    }

    @GetMapping("/profile")
    public Result<Void> profile() {
        return Result.fail(500, DISABLED);
    }

    @PutMapping("/profile")
    public Result<Void> updateProfile(@RequestBody Map<String, Object> body) {
        return Result.fail(500, DISABLED);
    }

    @PostMapping("/password")
    public Result<Void> updatePassword(@RequestBody Map<String, String> body) {
        return Result.fail(500, DISABLED);
    }
}
