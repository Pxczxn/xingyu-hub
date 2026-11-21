package top.pxczxn.xingyu.admin.controller.community;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.service.AdminContentAssetQueryService;
import top.pxczxn.xingyu.community.service.MomentService;
import top.pxczxn.xingyu.community.service.SeriesService;

import java.util.Locale;
import java.util.Map;

/** 管理端内容资产查询契约。按内容类型返回各自可运营字段，避免三类运营页展示同一套列与状态。 */
@RestController
@RequestMapping("/operations/content")
@RequiredArgsConstructor
public class AdminContentAssetController {
    private final AdminContentAssetQueryService contentAssetQueryService;
    private final MomentService momentService;
    private final SeriesService seriesService;

    @GetMapping
    public Result<Map<String, Object>> list(@RequestParam String type,
                                             @RequestParam(required = false) String keyword,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "20") int pageSize) {
        Map<String, Object> payload = contentAssetQueryService.list(type, keyword, status, page, pageSize);
        if (payload == null) {
            return Result.fail(422, "内容类型无效");
        }
        return Result.ok(payload);
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable String id, @RequestParam String type) {
        Map<String, Object> value = contentAssetQueryService.detail(id, type);
        if (value == null) {
            return Result.fail(404, "内容不存在");
        }
        return Result.ok(value);
    }

    @PatchMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String type = String.valueOf(body.getOrDefault("type", ""));
        String status = String.valueOf(body.getOrDefault("status", "")).toUpperCase(Locale.ROOT);
        if ("SERIES".equalsIgnoreCase(type) && ("ACTIVE".equals(status) || "ARCHIVED".equals(status))) {
            if (!seriesService.applyOperationalStatus(id, status)) {
                return Result.fail("内容不存在");
            }
        } else if ("MOMENT".equalsIgnoreCase(type) && ("PUBLISHED".equals(status) || "TRASHED".equals(status))) {
            if (!momentService.applyOperationalStatus(id, status)) {
                return Result.fail("内容不存在");
            }
        } else {
            return Result.fail(422, "内容类型或状态无效");
        }
        return Result.ok();
    }
}
