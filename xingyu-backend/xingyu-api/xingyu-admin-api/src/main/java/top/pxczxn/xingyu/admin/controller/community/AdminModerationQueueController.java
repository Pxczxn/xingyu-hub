package top.pxczxn.xingyu.admin.controller.community;

import cn.dev33.satoken.stp.StpUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.AppealAdminView;
import top.pxczxn.xingyu.community.dto.ReportAdminView;
import top.pxczxn.xingyu.community.entity.Appeal;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.service.ModerationService;

import java.util.Map;

@RestController
@RequestMapping("/moderation")
@RequiredArgsConstructor
public class AdminModerationQueueController {

    private final ModerationService moderationService;

    @GetMapping("/reports")
    public Result<?> reports(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "100") int limit) {
        return Result.ok(moderationService.listReportsForAdmin(status, Math.max(1, Math.min(limit, 200))));
    }

    @GetMapping("/appeals")
    public Result<?> appeals(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "100") int limit) {
        return Result.ok(moderationService.listAppealsForAdmin(status, Math.max(1, Math.min(limit, 200))));
    }

    @PostMapping("/reports/{id}/decide")
    public Result<Report> decideReport(@PathVariable String id, @RequestBody Map<String, String> body) {
        Report report = moderationService.decideReportQueue(
                id,
                String.valueOf(StpUtil.getLoginId()),
                body);
        return Result.ok(report);
    }

    @PostMapping("/appeals/{id}/decide")
    public Result<Appeal> decideAppeal(@PathVariable String id, @RequestBody Map<String, String> body) {
        Appeal appeal = moderationService.decideAppealQueue(
                id,
                String.valueOf(StpUtil.getLoginId()),
                body);
        return Result.ok(appeal);
    }
}
