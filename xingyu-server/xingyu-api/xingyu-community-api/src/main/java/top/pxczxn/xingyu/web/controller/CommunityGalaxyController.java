package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.GalaxyContentView;
import top.pxczxn.xingyu.community.dto.GalaxyJoinRequestView;
import top.pxczxn.xingyu.community.dto.GalaxyMemberView;
import top.pxczxn.xingyu.community.dto.GalaxyView;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.service.GalaxyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/galaxies")
@RequiredArgsConstructor
public class CommunityGalaxyController {

    private final GalaxyService galaxyService;

    @GetMapping
    public List<GalaxyView> list() {
        return galaxyService.list();
    }

    @GetMapping("/{slug}")
    public GalaxyView detail(@PathVariable String slug) {
        return galaxyService.getBySlug(slug);
    }

    @GetMapping("/{slug}/members")
    public List<GalaxyMemberView> members(
            @PathVariable String slug,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return galaxyService.listMembers(slug, limit);
    }

    @GetMapping("/{slug}/content")
    public List<GalaxyContentView> content(
            @PathVariable String slug,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return galaxyService.listContent(slug, limit);
    }

    @PostMapping("/{slug}/join")
    public GalaxyView join(@PathVariable String slug) {
        return galaxyService.join(CommunityAuthContext.requireUser(), slug);
    }

    @PostMapping("/{slug}/apply")
    public GalaxyJoinRequestView apply(
            @PathVariable String slug,
            @RequestBody(required = false) Map<String, String> body) {
        return galaxyService.apply(CommunityAuthContext.requireUser(), slug, body);
    }
}
