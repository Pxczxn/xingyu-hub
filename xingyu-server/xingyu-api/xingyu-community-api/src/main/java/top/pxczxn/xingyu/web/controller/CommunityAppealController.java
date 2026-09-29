package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.Appeal;
import top.pxczxn.xingyu.community.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/appeals")
@RequiredArgsConstructor
public class CommunityAppealController {

    private final ModerationService moderationService;

    @PostMapping
    public Map<String, String> submit(@RequestBody Map<String, String> body) {
        Appeal appeal = moderationService.submitAppeal(CommunityAuthContext.requireUser(), body);
        return Map.of("id", appeal.getId(), "status", appeal.getStatus());
    }
}
