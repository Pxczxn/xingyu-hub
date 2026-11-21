package top.pxczxn.xingyu.system.service.impl;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.system.mapper.ApiAccessLogAggRow;
import top.pxczxn.xingyu.system.mapper.ApiAccessLogMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiAccessLogStatisticsTest {

    @Test
    void emptyBucketsYieldZeroTotals() {
        Map<String, Object> stats = ApiAccessLogServiceImpl.assembleStatistics(List.of());
        assertEquals(0L, stats.get("totalCount"));
        assertEquals(0L, stats.get("successCount"));
        assertEquals(0L, stats.get("failCount"));
        assertTrue(((Map<?, ?>) stats.get("dailyStats")).isEmpty());
        assertTrue(((List<?>) stats.get("topPaths")).isEmpty());
        assertTrue(((Map<?, ?>) stats.get("methodCount")).isEmpty());
    }

    @Test
    void bucketsMatchPreviousInMemoryRules() {
        ApiAccessLogAggRow day1Get = row("2026-11-01", "/api/a", "GET", 3L, 1L);
        ApiAccessLogAggRow day1Post = row("2026-11-01", "/api/b", "POST", 0L, 2L);
        ApiAccessLogAggRow day2Get = row("2026-11-02", "/api/a", "GET", 4L, 0L);
        ApiAccessLogAggRow unknown = row("2026-11-02", null, null, 1L, 0L);

        Map<String, Object> stats = ApiAccessLogServiceImpl.assembleStatistics(
                List.of(day2Get, day1Get, day1Post, unknown));

        assertEquals(11L, stats.get("totalCount"));
        assertEquals(8L, stats.get("successCount"));
        assertEquals(3L, stats.get("failCount"));

        @SuppressWarnings("unchecked")
        Map<String, Map<String, Long>> daily = (Map<String, Map<String, Long>>) stats.get("dailyStats");
        assertEquals(List.of("2026-11-01", "2026-11-02"), daily.keySet().stream().toList());
        assertEquals(6L, daily.get("2026-11-01").get("total"));
        assertEquals(3L, daily.get("2026-11-01").get("success"));
        assertEquals(3L, daily.get("2026-11-01").get("fail"));
        assertEquals(5L, daily.get("2026-11-02").get("total"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topPaths = (List<Map<String, Object>>) stats.get("topPaths");
        assertEquals("/api/a", topPaths.getFirst().get("apiPath"));
        assertEquals(8L, topPaths.getFirst().get("count"));
        assertEquals("unknown", topPaths.getLast().get("apiPath"));

        @SuppressWarnings("unchecked")
        Map<String, Long> methods = (Map<String, Long>) stats.get("methodCount");
        assertEquals(8L, methods.get("GET"));
        assertEquals(2L, methods.get("POST"));
        assertEquals(1L, methods.get("unknown"));
    }

    @Test
    void serviceUsesInclusiveNextDayMidnightBounds() {
        ApiAccessLogMapper mapper = mock(ApiAccessLogMapper.class);
        ApiAccessLogServiceImpl service = new ApiAccessLogServiceImpl(null, null);
        TestMapperSupport.injectBaseMapper(service, mapper);
        LocalDate start = LocalDate.of(2026, 11, 1);
        LocalDate end = LocalDate.of(2026, 11, 7);
        LocalDateTime expectedStart = start.atStartOfDay();
        LocalDateTime expectedEnd = end.plusDays(1).atStartOfDay();
        when(mapper.selectStatisticsBuckets(expectedStart, expectedEnd)).thenReturn(List.of());

        service.getStatistics(start, end);

        verify(mapper).selectStatisticsBuckets(expectedStart, expectedEnd);
    }

    private static ApiAccessLogAggRow row(String date, String path, String method, Long success, Long fail) {
        ApiAccessLogAggRow row = new ApiAccessLogAggRow();
        row.setStatDate(date);
        row.setApiPath(path);
        row.setMethod(method);
        row.setSuccessCount(success);
        row.setFailCount(fail);
        return row;
    }
}
