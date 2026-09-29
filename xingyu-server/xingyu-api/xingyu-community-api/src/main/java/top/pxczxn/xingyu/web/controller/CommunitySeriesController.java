package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
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
    public List<SeriesSummaryView> listPublic(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return seriesService.listPublic(limit);
    }

    @GetMapping("/series/{seriesId}")
    public SeriesView getPublicById(@PathVariable String seriesId) {
        return seriesService.getPublicById(seriesId);
    }

    @GetMapping("/series/{username}/{slug}")
    public SeriesView getPublic(@PathVariable String username, @PathVariable String slug) {
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
