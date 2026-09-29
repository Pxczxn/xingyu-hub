package top.pxczxn.xingyu.admin.controller.community;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.FeaturedContentView;
import top.pxczxn.xingyu.community.service.RecommendationService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/community/featured")
@RequiredArgsConstructor
public class AdminFeaturedController {

    private final RecommendationService recommendationService;

    @GetMapping
    public Result<List<FeaturedContentView>> list(@RequestParam(defaultValue = "100") int limit) {
        return Result.ok(recommendationService.listFeaturedForAdmin(limit));
    }

    @PostMapping
    public Result<FeaturedContentView> create(@RequestBody Map<String, Object> body) {
        return Result.ok(recommendationService.addFeaturedForAdmin(body));
    }

    @DeleteMapping("/{featuredId}")
    public Result<Void> archive(@PathVariable String featuredId) {
        recommendationService.archiveFeaturedForAdmin(featuredId);
        return Result.ok();
    }
}
