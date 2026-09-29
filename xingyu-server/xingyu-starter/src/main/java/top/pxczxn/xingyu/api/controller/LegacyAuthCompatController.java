package top.pxczxn.xingyu.api.controller;

import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.entity.SysMenu;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysMenuService;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 兼容 xingyu-uniapp 旧路径 /api/v1/auth/*（不含 logout，已迁至 /api/v1/app/auth/logout）。
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class LegacyAuthCompatController {

    private final SysUserService userService;
    private final SysMenuService menuService;

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

    @GetMapping("/profile")
    public Result<SysUser> profile() {
        return Result.ok(userService.getDetail(StpUtil.getLoginIdAsLong()));
    }

    @PutMapping("/profile")
    public Result<Void> updateProfile(@RequestBody SysUser user) {
        userService.updateProfile(StpUtil.getLoginIdAsLong(), user);
        return Result.ok();
    }

    @PostMapping("/password")
    public Result<Void> updatePassword(@RequestBody Map<String, String> body) {
        userService.updatePassword(
                StpUtil.getLoginIdAsLong(),
                body.get("oldPassword"),
                body.get("newPassword"));
        return Result.ok();
    }
}
