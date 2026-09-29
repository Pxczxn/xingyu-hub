package top.pxczxn.xingyu.admin.controller.community;

import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.TopicAdminView;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.entity.TopicAlias;
import top.pxczxn.xingyu.community.entity.TopicMergeRecord;
import top.pxczxn.xingyu.community.service.TopicService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/topics")
@RequiredArgsConstructor
public class AdminTopicController {

    private final TopicService topicService;

    @GetMapping
    public Result<List<TopicAdminView>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return Result.ok(topicService.listAdminViews(keyword, status));
    }

    @PostMapping
    public Result<Topic> create(@RequestBody Map<String, String> body) {
        return Result.ok(topicService.create(
                body.get("slug"),
                body.get("name"),
                body.get("seedKey"),
                body.get("description")));
    }

    @PatchMapping("/{topicId}")
    public Result<Topic> update(@PathVariable String topicId, @RequestBody Map<String, String> body) {
        return Result.ok(topicService.update(
                topicId,
                body.get("slug"),
                body.get("name"),
                body.get("status"),
                body.get("description")));
    }

    @GetMapping("/{topicId}/aliases")
    public Result<List<TopicAlias>> aliases(@PathVariable String topicId) {
        return Result.ok(topicService.listAliases(topicId));
    }

    @PostMapping("/{topicId}/aliases")
    public Result<TopicAlias> addAlias(@PathVariable String topicId, @RequestBody Map<String, String> body) {
        return Result.ok(topicService.addAlias(topicId, body.get("aliasSlug")));
    }

    @PatchMapping("/{topicId}/parent")
    public Result<Topic> setParent(@PathVariable String topicId, @RequestBody Map<String, String> body) {
        return Result.ok(topicService.setParentTopic(topicId, body.get("parentTopicId")));
    }

    @PostMapping("/{sourceTopicId}/merge")
    public Result<TopicMergeRecord> merge(
            @PathVariable String sourceTopicId,
            @RequestBody Map<String, String> body) {
        TopicMergeRecord record = topicService.mergeTopics(
                sourceTopicId,
                body.get("targetTopicId"),
                String.valueOf(StpUtil.getLoginId()));
        return Result.ok(record);
    }
}
