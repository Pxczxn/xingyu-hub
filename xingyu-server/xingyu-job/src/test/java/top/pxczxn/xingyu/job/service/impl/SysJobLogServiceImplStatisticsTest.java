package top.pxczxn.xingyu.job.service.impl;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.job.mapper.SysJobLogMapper;
import top.pxczxn.xingyu.job.mapper.SysJobLogStatusCounts;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysJobLogServiceImplStatisticsTest {

    @Test
    void statisticsUsesOneTotalsQueryPlusDailyStats() {
        SysJobLogMapper mapper = mock(SysJobLogMapper.class);
        SysJobLogServiceImpl service = new SysJobLogServiceImpl();
        injectBaseMapper(service, mapper);

        SysJobLogStatusCounts counts = new SysJobLogStatusCounts();
        counts.setTotalCount(10L);
        counts.setSuccessCount(7L);
        counts.setFailCount(2L);
        when(mapper.selectStatusCounts()).thenReturn(counts);
        List<Map<String, Object>> daily = List.of(Map.of(
                "exec_date", "2026-11-20",
                "success_count", 3,
                "fail_count", 1));
        when(mapper.selectDailyStats()).thenReturn(daily);

        Map<String, Object> stats = service.statistics();

        assertEquals(10L, stats.get("totalCount"));
        assertEquals(7L, stats.get("successCount"));
        assertEquals(2L, stats.get("failCount"));
        assertEquals(daily, stats.get("dailyStats"));
        verify(mapper).selectStatusCounts();
        verify(mapper).selectDailyStats();
        verify(mapper, never()).selectCount(any());
    }

    @Test
    void nullCountsBecomeZero() {
        SysJobLogMapper mapper = mock(SysJobLogMapper.class);
        SysJobLogServiceImpl service = new SysJobLogServiceImpl();
        injectBaseMapper(service, mapper);
        when(mapper.selectStatusCounts()).thenReturn(null);
        when(mapper.selectDailyStats()).thenReturn(List.of());

        Map<String, Object> stats = service.statistics();

        assertEquals(0L, stats.get("totalCount"));
        assertEquals(0L, stats.get("successCount"));
        assertEquals(0L, stats.get("failCount"));
    }

    private static void injectBaseMapper(ServiceImpl<?, ?> service, BaseMapper<?> mapper) {
        Class<?> type = ServiceImpl.class;
        while (type != null) {
            try {
                Field field = type.getDeclaredField("baseMapper");
                field.setAccessible(true);
                field.set(service, mapper);
                return;
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            } catch (IllegalAccessException e) {
                throw new IllegalStateException(e);
            }
        }
        throw new IllegalStateException("ServiceImpl.baseMapper not found");
    }
}
