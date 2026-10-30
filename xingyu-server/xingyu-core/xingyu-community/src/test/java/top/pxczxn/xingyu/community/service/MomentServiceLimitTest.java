package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The public profile moment list is a capped, keyset-paged read.
 *
 * <p>`GET /users/{username}/moments?limit=999999` used to pass the raw value into the mapper and
 * then run the batched counter/profile passes over every returned row. The cap is a boundary of
 * the public endpoint, so it is pinned here without a database: the service must ask the mapper
 * for 50 (+1 probe), never for 999999. The probe row is what turns "the page ended" into
 * "there is another page", so the ceiling and the cursor are two halves of one contract.
 */
class MomentServiceLimitTest {

    private static final Instant BASE = Instant.parse("2026-10-30T00:00:00Z");

    private final MomentMapper momentMapper = mock(MomentMapper.class);
    private final EngagementMetricsService engagementMetrics = mock(EngagementMetricsService.class);
    private final MomentService service = new MomentService(
            momentMapper,
            mock(CommunityProfileMapper.class),
            mock(MomentRevisionMapper.class),
            mock(CommunityProperties.class),
            mock(CommunityEventSupport.class),
            engagementMetrics);

    @Test
    @DisplayName("公开主页动态把超大的 limit 收紧到 50")
    void clampsPublicAuthorListLimit() {
        when(momentMapper.listByAuthorId("author-1", 51)).thenReturn(List.of());
        stubCounters();

        PageResultView<MomentView> page = service.listPublishedByAuthor("author-1", 999_999, null, null);

        assertThat(page.getItems()).isEmpty();
        assertThat(page.getNextCursor()).isNull();
        verify(momentMapper).listByAuthorId("author-1", 51);
    }

    @Test
    @DisplayName("整页之外还有内容时只返回 50 条并给出 nextCursor")
    void fullPageReportsNextCursorAndDropsProbeRow() {
        when(momentMapper.listByAuthorId("author-1", 51)).thenReturn(rows(51));
        stubCounters();

        PageResultView<MomentView> page = service.listPublishedByAuthor("author-1", 50, null, null);

        assertThat(page.getItems()).hasSize(50);
        assertThat(page.getNextCursor()).isNotBlank();
        assertThat(page.getItems().get(49).getId()).isEqualTo("m49");
    }

    @Test
    @DisplayName("非法游标是 400 级错误，不回退到第一页")
    void malformedCursorIsRejected() {
        assertThatThrownBy(() -> service.listPublishedByAuthor("author-1", 20, "!!!", null))
                .isInstanceOf(FieldContractException.class);
        verify(momentMapper, never()).listByAuthorId(anyString(), anyInt());
    }

    private void stubCounters() {
        when(engagementMetrics.likeCounts(anyString(), anyList())).thenReturn(Map.of());
        when(engagementMetrics.commentCounts(anyString(), anyList())).thenReturn(Map.of());
    }

    private static List<Moment> rows(int count) {
        return IntStream.range(0, count)
                .mapToObj(index -> {
                    Moment moment = new Moment();
                    moment.setId("m" + index);
                    moment.setAuthorId("author-1");
                    moment.setStatus("PUBLISHED");
                    moment.setCreatedAt(BASE.minusSeconds(index));
                    moment.setUpdatedAt(BASE.minusSeconds(index));
                    return moment;
                })
                .toList();
    }
}
