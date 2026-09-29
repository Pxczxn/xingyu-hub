package top.pxczxn.xingyu.job.util;

import top.pxczxn.xingyu.job.entity.SysJob;
import org.quartz.JobExecutionContext;

/**
 * 定时任务执行（允许并发执行）
 */
public class QuartzJobExecution extends AbstractQuartzJob {
    
    @Override
    protected void doExecute(JobExecutionContext context, SysJob job) throws Exception {
        JobInvokeUtil.invokeMethod(job);
    }
}
