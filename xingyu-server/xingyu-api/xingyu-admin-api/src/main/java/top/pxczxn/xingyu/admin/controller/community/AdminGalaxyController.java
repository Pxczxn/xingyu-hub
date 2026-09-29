package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.GalaxyContentView;
import top.pxczxn.xingyu.community.dto.GalaxyMemberView;
import top.pxczxn.xingyu.community.dto.GalaxyJoinRequestView;
import top.pxczxn.xingyu.community.dto.GalaxyView;
import top.pxczxn.xingyu.community.service.GalaxyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/community/galaxies")
@RequiredArgsConstructor
public class AdminGalaxyController {

    private final GalaxyService galaxyService;

    @GetMapping
    public Result<List<GalaxyView>> list() {
        return Result.ok(galaxyService.list());
    }

    @PostMapping
    public Result<GalaxyView> create(@RequestBody Map<String, Object> body) {
        return Result.ok(galaxyService.createForAdmin(body));
    }

    @PatchMapping("/{galaxyId}")
    public Result<GalaxyView> update(@PathVariable String galaxyId, @RequestBody Map<String, Object> body) {
        return Result.ok(galaxyService.updateForAdmin(galaxyId, body));
    }

    @GetMapping("/{slug}/members")
    public Result<List<GalaxyMemberView>> listMembers(
            @PathVariable String slug,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.ok(galaxyService.listMembers(slug, limit));
    }

    @GetMapping("/{slug}/content")
    public Result<List<GalaxyContentView>> listContent(
            @PathVariable String slug,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.ok(galaxyService.listContent(slug, limit));
    }

    @PostMapping("/{galaxyId}/content")
    public Result<GalaxyContentView> addContent(
            @PathVariable String galaxyId,
            @RequestBody Map<String, Object> body) {
        boolean pinned = Boolean.TRUE.equals(body.get("pinned")) || "true".equals(String.valueOf(body.get("pinned")));
        return Result.ok(galaxyService.addContentForAdmin(
                galaxyId,
                String.valueOf(body.get("objectType")),
                String.valueOf(body.get("objectId")),
                pinned));
    }

    @DeleteMapping("/content/{contentId}")
    public Result<Void> removeContent(@PathVariable String contentId) {
        galaxyService.removeContentForAdmin(contentId);
        return Result.ok();
    }

    @GetMapping("/{galaxyId}/join-requests")
    public Result<List<GalaxyJoinRequestView>> listJoinRequests(
            @PathVariable String galaxyId,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.ok(galaxyService.listPendingJoinRequestsForAdmin(galaxyId, limit));
    }

    @PostMapping("/join-requests/{requestId}/approve")
    public Result<Void> approveJoinRequest(@PathVariable String requestId) {
        galaxyService.approveJoinRequestForAdmin(requestId);
        return Result.ok();
    }

    @PostMapping("/join-requests/{requestId}/reject")
    public Result<Void> rejectJoinRequest(@PathVariable String requestId) {
        galaxyService.rejectJoinRequestForAdmin(requestId);
        return Result.ok();
    }
}
