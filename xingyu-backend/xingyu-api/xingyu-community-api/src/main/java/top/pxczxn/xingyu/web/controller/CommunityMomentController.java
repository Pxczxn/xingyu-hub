package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.service.MomentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/moments")
@RequiredArgsConstructor
public class CommunityMomentController {

    private final MomentService momentService;

    @GetMapping
    public List<MomentView> list(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return momentService.listPublished(limit);
    }

    @GetMapping("/{momentId}")
    public MomentView get(@PathVariable String momentId) {
        return momentService.getById(momentId);
    }

    @PostMapping
    public MomentView publish(@RequestBody Map<String, String> body) {
        return momentService.publish(CommunityAuthContext.requireUser(), body);
    }

    @PatchMapping("/{momentId}")
    public MomentView update(@PathVariable String momentId, @RequestBody Map<String, String> body) {
        return momentService.update(CommunityAuthContext.requireUser(), momentId, body);
    }

    @PostMapping("/{momentId}/trash")
    public MomentView trash(@PathVariable String momentId) {
        return momentService.trash(CommunityAuthContext.requireUser(), momentId);
    }
}
