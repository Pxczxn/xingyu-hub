package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.GuidePageView;
import top.pxczxn.xingyu.community.service.GuideService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/guide")
@RequiredArgsConstructor
public class CommunityGuideController {

    private final GuideService guideService;

    @GetMapping
    public List<GuidePageView> list(@RequestParam(value = "limit", defaultValue = "50") int limit) {
        return guideService.listPublished(limit);
    }

    @GetMapping("/{slug}")
    public GuidePageView detail(@PathVariable String slug) {
        return guideService.getBySlug(slug);
    }
}
