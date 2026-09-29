package top.pxczxn.xingyu.admin.controller.community;

import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.ModerationCaseView;
import top.pxczxn.xingyu.community.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/moderation")
@RequiredArgsConstructor
public class AdminModerationController {

    private final ModerationService moderationService;

    @GetMapping("/cases")
    public Result<List<ModerationCaseView>> openCases() {
        return Result.ok(moderationService.listOpenCases());
    }

    @PostMapping("/cases/{caseId}/decide")
    public Result<ModerationCaseView> decide(
            @PathVariable String caseId,
            @RequestBody Map<String, String> body) {
        ModerationCaseView view = moderationService.decideCase(
                caseId,
                String.valueOf(StpUtil.getLoginId()),
                body);
        return Result.ok(view);
    }
}
