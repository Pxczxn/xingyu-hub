package top.pxczxn.xingyu.job.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.job.entity.SysJobLog;

import java.util.Map;

/**
 * 定时任务日志服务接口
 */
public interface SysJobLogService extends IService<SysJobLog> {

    /**
     * 分页查询
     */
    PageResult<SysJobLog> page(Integer page, Integer pageSize, String jobName, String jobGroup, Integer status);

    /**
     * 调度统计（总数、成功、失败、近7日趋势）
     */
    Map<String, Object> statistics();

    /**
     * 清空日志
     */
    void clean();
}
