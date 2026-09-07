package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.EventSubmissionAdminView;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import top.pxczxn.xingyu.community.service.CommunityEventService;
import lombok.RequiredArgsConstructor;
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
@RequestMapping("/community/events")
@RequiredArgsConstructor
public class AdminEventController {

    private final CommunityEventService eventService;

    @GetMapping
    public Result<List<CommunityEvent>> list(@RequestParam(defaultValue = "100") int limit) {
        return Result.ok(eventService.listForAdmin(limit));
    }

    @PostMapping
    public Result<CommunityEvent> create(@RequestBody Map<String, Object> body) {
        return Result.ok(eventService.createForAdmin(body));
    }

    @PatchMapping("/{eventId}")
    public Result<CommunityEvent> update(@PathVariable String eventId, @RequestBody Map<String, Object> body) {
        return Result.ok(eventService.updateForAdmin(eventId, body));
    }

    @GetMapping("/{eventId}/submissions")
    public Result<List<EventSubmissionAdminView>> listSubmissions(
            @PathVariable String eventId,
            @RequestParam(defaultValue = "100") int limit) {
        return Result.ok(eventService.listSubmissionsForAdmin(eventId, limit));
    }

    @PostMapping("/submissions/{submissionId}/review")
    public Result<EventSubmissionAdminView> reviewSubmission(
            @PathVariable String submissionId,
            @RequestBody Map<String, String> body) {
        return Result.ok(eventService.reviewSubmissionForAdmin(submissionId, body));
    }
}
