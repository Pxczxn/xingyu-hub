package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.AdminPasswordResetResult;
import top.pxczxn.xingyu.community.dto.CommunityUserAdminView;
import top.pxczxn.xingyu.community.dto.CommunityUserStatistics;
import top.pxczxn.xingyu.community.service.CommunityUserAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/community/users")
@RequiredArgsConstructor
public class AdminCommunityUserController {

    private final CommunityUserAdminService communityUserAdminService;

    @GetMapping
    public Result<PageResult<CommunityUserAdminView>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role) {
        return Result.ok(communityUserAdminService.list(page, pageSize, status, keyword, role));
    }

    @GetMapping("/statistics")
    public Result<CommunityUserStatistics> statistics() {
        return Result.ok(communityUserAdminService.statistics());
    }

    /**
     * 按 ID 获取社区用户详情，供 /community/users/:userId deep link 直接打开详情使用。
     * 字面量路径 /statistics 的匹配优先级高于本 URI 模板，二者不会冲突。
     */
    @GetMapping("/{userId}")
    public Result<CommunityUserAdminView> detail(@PathVariable String userId) {
        return Result.ok(communityUserAdminService.detail(userId));
    }

    @PostMapping("/{userId}/approve")
    public Result<Void> approve(@PathVariable String userId) {
        communityUserAdminService.approve(userId);
        return Result.ok();
    }

    @PostMapping("/{userId}/reject")
    public Result<Void> reject(@PathVariable String userId) {
        communityUserAdminService.reject(userId);
        return Result.ok();
    }

    @PostMapping("/{userId}/reset-password")
    public Result<AdminPasswordResetResult> resetPassword(@PathVariable String userId) {
        return Result.ok(communityUserAdminService.resetPassword(userId));
    }
}
