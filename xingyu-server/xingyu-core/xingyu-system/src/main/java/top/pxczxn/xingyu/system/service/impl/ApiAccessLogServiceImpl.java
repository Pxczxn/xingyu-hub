package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.ApiAccessLog;
import top.pxczxn.xingyu.system.mapper.ApiAccessLogAggRow;
import top.pxczxn.xingyu.system.mapper.ApiAccessLogMapper;
import top.pxczxn.xingyu.system.service.ApiAccessLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * API 访问日志服务实现
 * 实时统计走 Redis，报表分析走 MySQL
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiAccessLogServiceImpl extends ServiceImpl<ApiAccessLogMapper, ApiAccessLog>
        implements ApiAccessLogService {

    private static final String REDIS_QUEUE_KEY = "api:access:log:queue";
    private static final int BATCH_SIZE = 500;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Async
    public void pushToRedis(ApiAccessLog accessLog) {
        try {
            String json = objectMapper.writeValueAsString(accessLog);
            redisTemplate.opsForList().leftPush(REDIS_QUEUE_KEY, json);
        } catch (Exception e) {
            log.error("API 访问日志写入 Redis 失败", e);
        }
    }

    @Override
    public void flushFromRedisToDb() {
        try {
            List<ApiAccessLog> batch = new ArrayList<>();
            for (int i = 0; i < BATCH_SIZE; i++) {
                String json = redisTemplate.opsForList().rightPop(REDIS_QUEUE_KEY);
                if (json == null) break;
                try {
                    ApiAccessLog log = objectMapper.readValue(json, ApiAccessLog.class);
                    batch.add(log);
                } catch (Exception e) {
                    log.warn("解析 API 日志 JSON 失败: {}", json, e);
                }
            }
            if (!batch.isEmpty()) {
                saveBatch(batch);
                log.debug("API 访问日志批量落库: {} 条", batch.size());
            }
        } catch (Exception e) {
            log.error("API 访问日志批量落库失败", e);
        }
    }

    @Override
    public PageResult<ApiAccessLog> page(Integer page, Integer pageSize, String apiPath, String method,
                                        Integer success, LocalDateTime startTime, LocalDateTime endTime) {
        Page<ApiAccessLog> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<ApiAccessLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(apiPath), ApiAccessLog::getApiPath, apiPath)
                .eq(StringUtils.hasText(method), ApiAccessLog::getMethod, method)
                .eq(success != null, ApiAccessLog::getSuccess, success)
                .ge(startTime != null, ApiAccessLog::getStartTime, startTime)
                .le(endTime != null, ApiAccessLog::getEndTime, endTime)
                .orderByDesc(ApiAccessLog::getStartTime);
        return PageResult.of(page(pageParam, wrapper));
    }

    @Override
    public Map<String, Object> getStatistics(LocalDate startDate, LocalDate endDate) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.plusDays(1).atStartOfDay();
        return assembleStatistics(baseMapper.selectStatisticsBuckets(start, end));
    }

    /**
     * Assemble the statistics payload from SQL buckets. Package-visible for contract tests.
     */
    static Map<String, Object> assembleStatistics(List<ApiAccessLogAggRow> rows) {
        long total = 0L;
        long successCount = 0L;
        Map<String, Map<String, Long>> dailyStats = new LinkedHashMap<>();
        Map<String, Long> pathCount = new HashMap<>();
        Map<String, Long> methodCount = new HashMap<>();

        if (rows != null) {
            for (ApiAccessLogAggRow row : rows) {
                long success = nz(row.getSuccessCount());
                long fail = nz(row.getFailCount());
                long bucketTotal = success + fail;
                total += bucketTotal;
                successCount += success;

                if (row.getStatDate() != null) {
                    Map<String, Long> dayMap = dailyStats.computeIfAbsent(row.getStatDate(), k -> emptyDay());
                    dayMap.put("total", dayMap.get("total") + bucketTotal);
                    dayMap.put("success", dayMap.get("success") + success);
                    dayMap.put("fail", dayMap.get("fail") + fail);
                }

                String path = row.getApiPath() != null ? row.getApiPath() : "unknown";
                pathCount.merge(path, bucketTotal, Long::sum);
                String method = row.getMethod() != null ? row.getMethod() : "unknown";
                methodCount.merge(method, bucketTotal, Long::sum);
            }
        }

        List<String> orderedDates = dailyStats.keySet().stream().sorted().toList();
        Map<String, Map<String, Long>> orderedDaily = new LinkedHashMap<>();
        for (String date : orderedDates) {
            orderedDaily.put(date, dailyStats.get(date));
        }

        List<Map<String, Object>> topPaths = pathCount.entrySet().stream()
                .sorted((a, b) -> {
                    int byCount = Long.compare(b.getValue(), a.getValue());
                    return byCount != 0 ? byCount : a.getKey().compareTo(b.getKey());
                })
                .limit(10)
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("apiPath", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("totalCount", total);
        result.put("successCount", successCount);
        result.put("failCount", total - successCount);
        result.put("dailyStats", orderedDaily);
        result.put("topPaths", topPaths);
        result.put("methodCount", methodCount);
        return result;
    }

    private static Map<String, Long> emptyDay() {
        Map<String, Long> m = new HashMap<>();
        m.put("total", 0L);
        m.put("success", 0L);
        m.put("fail", 0L);
        return m;
    }

    private static long nz(Long value) {
        return value == null ? 0L : value;
    }
}
