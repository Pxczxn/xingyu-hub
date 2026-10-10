package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ReportTargetView;
import top.pxczxn.xingyu.community.dto.UserReportView;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class CommunityModerationController {

    private final ModerationService moderationService;

    /**
     * 举报前的目标预览：从内容页带着 objectType/objectId 过来时，先由服务端确认
     * "这条内容存在、能举报、是谁的、长什么样"。前端不自行拼装标题/作者。
     */
    @GetMapping("/target")
    public ReportTargetView target(
            @RequestParam String objectType,
            @RequestParam String objectId) {
        return moderationService.previewReportTarget(
                CommunityAuthContext.requireUser(), objectType, objectId);
    }

    @PostMapping
    public Map<String, String> submit(@RequestBody Map<String, String> body) {
        Report report = moderationService.submitReport(CommunityAuthContext.requireUser(), body);
        return Map.of(
                "reportId", report.getId(),
                "id", report.getId(),
                "status", report.getStatus());
    }

    @GetMapping("/mine")
    public List<UserReportView> myReportsAlias() {
        return moderationService.listMyReports(CommunityAuthContext.requireUser());
    }
}
