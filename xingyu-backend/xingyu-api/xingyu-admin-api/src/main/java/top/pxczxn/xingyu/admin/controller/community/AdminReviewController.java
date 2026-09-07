package top.pxczxn.xingyu.admin.controller.community;

import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.ReviewQueueItemView;
import top.pxczxn.xingyu.community.entity.ReviewDecision;
import top.pxczxn.xingyu.community.service.ReviewService;
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
@RequestMapping("/review")
@RequiredArgsConstructor
public class AdminReviewController {

    private final ReviewService reviewService;

    @GetMapping("/queue")
    public Result<List<ReviewQueueItemView>> queue() {
        return Result.ok(reviewService.listPendingQueue());
    }

    @PostMapping("/{submissionId}/decide")
    public Result<ReviewDecision> decide(
            @PathVariable String submissionId,
            @RequestBody Map<String, String> body) {
        ReviewDecision decision = reviewService.decide(
                submissionId,
                String.valueOf(StpUtil.getLoginId()),
                body.get("decision"),
                body.get("comment"));
        return Result.ok(decision);
    }
}
