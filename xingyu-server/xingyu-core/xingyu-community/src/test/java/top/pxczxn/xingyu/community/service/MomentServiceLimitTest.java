package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Public moment lists are capped at 50 rows.
 *
 * <p>`GET /users/{username}/moments?limit=999999` used to pass the raw value into the mapper and
 * then run the batched counter/profile passes over every returned row. The cap is a boundary of
 * the public endpoint, so it is pinned here without a database: the service must ask the mapper
 * for 50, not 999999.
 */
class MomentServiceLimitTest {

    @Test
    @DisplayName("公开主页动态把超大的 limit 收紧到 50")
    void clampsPublicAuthorListLimit() {
        MomentMapper momentMapper = mock(MomentMapper.class);
        MomentService service = new MomentService(
                momentMapper,
                mock(CommunityProfileMapper.class),
                mock(MomentRevisionMapper.class),
                mock(CommunityProperties.class),
                mock(CommunityEventSupport.class),
                mock(EngagementMetricsService.class));
        when(momentMapper.listByAuthorId("author-1", 50)).thenReturn(List.of());

        assertThat(service.listPublishedByAuthor("author-1", 999_999, null)).isEmpty();
        verify(momentMapper).listByAuthorId("author-1", 50);
    }
}
