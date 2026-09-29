package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.TopicCreatorView;
import top.pxczxn.xingyu.community.dto.TopicPublicView;
import top.pxczxn.xingyu.community.service.TopicService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/topics")
@RequiredArgsConstructor
public class CommunityTopicController {

    private final TopicService topicService;

    @GetMapping
    public List<TopicPublicView> list(@RequestParam(required = false) String keyword) {
        return topicService.listPublicViews(keyword);
    }

    @GetMapping("/{slug}")
    public TopicPublicView detail(@PathVariable String slug) {
        return topicService.getPublicView(slug);
    }

    @GetMapping("/{slug}/content")
    public List<ContentCardView> content(
            @PathVariable String slug,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "12") int limit) {
        return topicService.listContent(slug, sort, limit);
    }

    @GetMapping("/{slug}/creators")
    public List<TopicCreatorView> creators(
            @PathVariable String slug,
            @RequestParam(defaultValue = "12") int limit) {
        return topicService.listCreators(slug, limit);
    }
}
