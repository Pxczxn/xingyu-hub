package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.AnnouncementView;
import top.pxczxn.xingyu.community.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/announcements")
@RequiredArgsConstructor
public class CommunityAnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping
    public List<AnnouncementView> list(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return announcementService.listPublished(limit);
    }

    @GetMapping("/{announcementId}")
    public AnnouncementView detail(@PathVariable String announcementId) {
        return announcementService.getById(announcementId);
    }
}
