package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.UserReportView;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class CommunityModerationController {

    private final ModerationService moderationService;

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
