package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.entity.GuidePage;
import top.pxczxn.xingyu.community.service.GuideService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/community/guide-pages")
@RequiredArgsConstructor
public class AdminGuideController {

    private final GuideService guideService;

    @GetMapping
    public Result<List<GuidePage>> list() {
        return Result.ok(guideService.listForAdmin());
    }

    @PostMapping
    public Result<GuidePage> create(@RequestBody Map<String, String> body) {
        return Result.ok(guideService.createForAdmin(body));
    }

    @PatchMapping("/{pageId}")
    public Result<GuidePage> update(@PathVariable String pageId, @RequestBody Map<String, String> body) {
        return Result.ok(guideService.updateForAdmin(pageId, body));
    }
}
