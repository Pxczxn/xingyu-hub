package top.pxczxn.xingyu.job.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.job.entity.SysJobLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 定时任务日志Mapper
 */
@Mapper
public interface SysJobLogMapper extends BaseMapper<SysJobLog> {

    /**
     * 近7日调度统计（日期、成功数、失败数）
     */
    @Select("SELECT DATE_FORMAT(start_time, '%Y-%m-%d') AS exec_date, " +
            "SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS success_count, " +
            "SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS fail_count " +
            "FROM sys_job_log " +
            "WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) " +
            "GROUP BY DATE_FORMAT(start_time, '%Y-%m-%d') " +
            "ORDER BY exec_date")
    List<Map<String, Object>> selectDailyStats();
}
