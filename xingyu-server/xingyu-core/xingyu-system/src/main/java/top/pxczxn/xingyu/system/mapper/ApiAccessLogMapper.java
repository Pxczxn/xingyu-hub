package top.pxczxn.xingyu.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.system.entity.ApiAccessLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * API 访问日志 Mapper
 */
@Mapper
public interface ApiAccessLogMapper extends BaseMapper<ApiAccessLog> {

    /**
     * Date-range aggregation using {@code idx_start_time}. Inclusive bounds match
     * the previous {@code BETWEEN start AND end} filter (end is next-day midnight).
     */
    @Select("""
            SELECT DATE_FORMAT(start_time, '%Y-%m-%d') AS statDate,
                   COALESCE(api_path, 'unknown') AS apiPath,
                   COALESCE(`method`, 'unknown') AS method,
                   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCount,
                   SUM(CASE WHEN success = 1 THEN 0 ELSE 1 END) AS failCount
            FROM sys_api_access_log
            WHERE start_time >= #{start} AND start_time <= #{end}
            GROUP BY DATE_FORMAT(start_time, '%Y-%m-%d'),
                     COALESCE(api_path, 'unknown'),
                     COALESCE(`method`, 'unknown')
            """)
    List<ApiAccessLogAggRow> selectStatisticsBuckets(@Param("start") LocalDateTime start,
                                                     @Param("end") LocalDateTime end);
}
