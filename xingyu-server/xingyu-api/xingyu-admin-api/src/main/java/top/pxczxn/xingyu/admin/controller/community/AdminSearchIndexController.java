package top.pxczxn.xingyu.admin.controller.community;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.dto.SearchIndexHealthView;
import top.pxczxn.xingyu.community.service.SearchIndexMaintenanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;

/**
 * 搜索索引运维入口 —— 产品文档 §20.3（「索引更新失败必须可重试和人工重建」、
 * 「提供按资源或全量重建索引能力时必须限权」）与 §1840 的「搜索索引健康、dead-letter、重建」。
 *
 * <p><b>限权方式</b>：整个 {@code /api/v1/admin/**} 已由 {@code SaTokenConfig} 统一要求管理员登录，
 * 所以这里不需要（也不应该）再叠一套自己的鉴权 —— §20.3 要求的「限权」就是靠它只存在于管理端前缀下。
 *
 * <p>三个动作的语义差别很重要：
 * <ul>
 *   <li>{@code GET /health} —— 只读。同时看投影（`search_document` 的 live/removed）
 *       和 outbox（积压 / 重试 / 死信）。只看投影会漏掉「索引是对的但事件卡住了」，
 *       只看事件会漏掉「事件都成功了但投影里有残留」。</li>
 *   <li>{@code POST /rebuild/{objectType}/{objectId}} —— 单资源，**同步**完成，失败会直接报错。</li>
 *   <li>{@code POST /rebuild} —— 全量，**只入队**。返回的是排队条数，不是改动行数：
 *       此刻还没有消费。要观察进度请看 health 的 pendingEvents。</li>
 * </ul>
 */
@RestController
@RequestMapping("/community/search-index")
@RequiredArgsConstructor
public class AdminSearchIndexController {

    private final SearchIndexMaintenanceService maintenanceService;

    @GetMapping("/health")
    public Result<SearchIndexHealthView> health() {
        return Result.ok(maintenanceService.health());
    }

    @PostMapping("/rebuild/{objectType}/{objectId}")
    public Result<Map<String, String>> rebuildOne(
            @PathVariable String objectType, @PathVariable String objectId) {
        String normalizedType = objectType == null
                ? ""
                : objectType.trim().toUpperCase(Locale.ROOT);
        maintenanceService.rebuildOne(normalizedType, objectId);
        return Result.ok(Map.of(
                "objectType", normalizedType,
                "objectId", objectId,
                "status", "REBUILT"));
    }

    @PostMapping("/rebuild")
    public Result<Map<String, Long>> rebuildAll() {
        return Result.ok(Map.of("queued", maintenanceService.rebuildAll()));
    }
}
