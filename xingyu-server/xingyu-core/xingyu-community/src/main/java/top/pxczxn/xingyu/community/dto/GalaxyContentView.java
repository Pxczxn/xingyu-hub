package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 星系内容行（Galaxy Content Contract，2026-10-10 Phase 4.2）。
 *
 * <p>静态展示块（id → updatedAt）与 {@link ContentCardView} 的静态子集同构——
 * 这是共享的 ContentSummary 形状；Galaxy 特有的只有 {@code pinned}。
 * 刻意<b>不</b>复用整个 ContentCardView：那是 feed 卡语义，携带 viewer 态
 * （bookmarked/liked）、featured、章节进度等 Galaxy 行不需要也不会填充的字段。
 *
 * <p>填充来源：title/summary/updatedAt 来自 {@code search_document}
 * （<b>removed_at IS NULL</b> 的活文档，被治理隐藏的内容自动从星系消失）；
 * cover 来自 {@code ContentCoverService}；authorName 来自
 * {@code HomeFeedEnrichmentService.enrich} 的批量 Presentation（复用现有
 * 每类型批量查询机制，不新增逐行查询）。文档缺失（未入索引或已下架）的
 * galaxy_content 行<b>不产生视图</b>——挂载的前提就是已入索引。
 */
@Value
@Builder
public class GalaxyContentView {
    String id;
    String objectType;
    String objectId;
    String title;
    String summary;
    String cover;
    String authorName;
    Instant updatedAt;
    boolean pinned;
}
