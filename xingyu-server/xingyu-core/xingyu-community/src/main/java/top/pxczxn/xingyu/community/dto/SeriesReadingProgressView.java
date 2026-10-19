package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 单个系列的阅读进度（viewer-scoped，2026-10-19 Phase 3C）。
 *
 * <p>只描述"上次读到的章节"，不描述"章节内读到哪里"——{@code series_reader_state}
 * 只保存最后阅读文章与时间，没有任何百分比数据。客户端不得据此渲染进度百分比。
 *
 * <p>字段语义：
 * <ul>
 *   <li>{@code readingHistoryEnabled}：当前用户是否允许记录阅读历史。关闭时下方所有
 *       进度字段为空，客户端应把它当作"没有可继续的进度"，而不是读取失败。</li>
 *   <li>{@code chapterArticleId}：上一次成功记录的章节文章标识；仅当它<b>仍然属于</b>
 *       该系列、且当前对该用户可读时才有值。章节被移除、文章下架或系列不再公开时为空。</li>
 *   <li>{@code chapterIndex}：该章节在系列中的 1-based 序号；与 {@code chapterArticleId}
 *       同生共死。没有值时不代表"第 0 章"，只代表无法安全定位。</li>
 *   <li>{@code chapterCount}：系列当前章节总数（公开事实）。</li>
 *   <li>{@code lastReadAt}：最后一次记录时间；没有记录时为 null。</li>
 * </ul>
 */
@Value
@Builder
public class SeriesReadingProgressView {
    boolean readingHistoryEnabled;
    String chapterArticleId;
    Integer chapterIndex;
    int chapterCount;
    Instant lastReadAt;
}
