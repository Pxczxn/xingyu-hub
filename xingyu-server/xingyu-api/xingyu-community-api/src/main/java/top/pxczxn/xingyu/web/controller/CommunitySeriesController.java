package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.PublicSeriesSummaryView;
import top.pxczxn.xingyu.community.dto.PublicSeriesView;
import top.pxczxn.xingyu.community.dto.SeriesSummaryView;
import top.pxczxn.xingyu.community.dto.SeriesView;
import top.pxczxn.xingyu.community.service.ReadingService;
import top.pxczxn.xingyu.community.service.SeriesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class CommunitySeriesController {

    private final SeriesService seriesService;
    private final ReadingService readingService;

    @GetMapping("/series")
    public List<PublicSeriesSummaryView> listPublic(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return seriesService.listPublic(limit);
    }

    /**
     * 系列广场目录（2026-10-18）：keyset 分页 + 全集合搜索。
     *
     * <p>与上面的 {@code GET /series} 并存：旧端点保持裸数组响应，避免打断既有调用方；
     * 广场页需要 nextCursor 与真实总数，因此走这一条。字面量路径优先于
     * {@code /series/{seriesId}} 的模板匹配，不会被当作系列 id。
     */
    @GetMapping("/series/search")
    public PageResultView<PublicSeriesSummaryView> searchPublic(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "cursor", required = false) String cursor) {
        return seriesService.searchPublic(query, limit, cursor);
    }

    @GetMapping("/series/{seriesId}")
    public PublicSeriesView getPublicById(@PathVariable String seriesId) {
        return seriesService.getPublicById(seriesId);
    }

    @GetMapping("/series/{username}/{slug}")
    public PublicSeriesView getPublic(@PathVariable String username, @PathVariable String slug) {
        return seriesService.getPublic(username, slug);
    }

    @GetMapping("/me/series")
    public List<SeriesSummaryView> listMine() {
        return seriesService.listForOwner(CommunityAuthContext.requireUser());
    }

    @PostMapping("/me/series")
    public SeriesView create(@RequestBody Map<String, Object> body) {
        return seriesService.create(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/me/series/{seriesId}")
    public SeriesView getMine(@PathVariable String seriesId) {
        return seriesService.getForOwner(CommunityAuthContext.requireUser(), seriesId);
    }

    @PutMapping("/me/series/{seriesId}")
    public SeriesView update(@PathVariable String seriesId, @RequestBody Map<String, Object> body) {
        return seriesService.update(CommunityAuthContext.requireUser(), seriesId, body);
    }

    @PostMapping("/me/series/{seriesId}/subscribe")
    public ResponseEntity<Void> subscribe(@PathVariable String seriesId) {
        readingService.subscribeSeries(CommunityAuthContext.requireUser(), seriesId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me/series/{seriesId}/subscribe")
    public ResponseEntity<Void> unsubscribe(@PathVariable String seriesId) {
        readingService.unsubscribeSeries(CommunityAuthContext.requireUser(), seriesId);
        return ResponseEntity.noContent().build();
    }
}
