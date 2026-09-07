package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CommunitySearchController {

    private final SearchService searchService;

    @GetMapping("/search")
    public List<SearchResultView> search(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return searchService.search(query, limit);
    }
}
