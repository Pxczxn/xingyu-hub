package top.pxczxn.xingyu.admin.controller.community;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.entity.Announcement;
import top.pxczxn.xingyu.community.service.AnnouncementService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/operations/announcements")
@RequiredArgsConstructor
public class AdminAnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping
    public Result<List<Announcement>> list() {
        return Result.ok(announcementService.listForAdmin());
    }

    @PostMapping
    public Result<Announcement> create(@RequestBody Map<String, Object> body) {
        return Result.ok(announcementService.createForAdmin(body));
    }

    @PatchMapping("/{id}")
    public Result<Announcement> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        return Result.ok(announcementService.updateStatusForAdmin(id, body));
    }
}
