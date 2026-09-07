package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.CommunityUserAdminView;
import top.pxczxn.xingyu.community.service.CommunityUserAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/community/users")
@RequiredArgsConstructor
public class AdminCommunityUserController {

    private final CommunityUserAdminService communityUserAdminService;

    @GetMapping
    public Result<List<CommunityUserAdminView>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.ok(communityUserAdminService.list(status, username, email, phone, keyword, limit));
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
}
