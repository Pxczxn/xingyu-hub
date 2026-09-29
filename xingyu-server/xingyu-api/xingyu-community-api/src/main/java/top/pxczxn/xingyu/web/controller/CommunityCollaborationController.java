package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.service.CollaborationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/collaboration")
@RequiredArgsConstructor
public class CommunityCollaborationController {

    private final CollaborationService collaborationService;

    @GetMapping("/invites/resolve")
    public Map<String, Object> resolveInvite(@RequestParam("token") String token) {
        return collaborationService.resolveInvite(token);
    }

    @PostMapping("/invites/accept")
    public Map<String, Object> acceptInvite(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        return collaborationService.acceptInvite(CommunityAuthContext.requireUser(), token);
    }
}
