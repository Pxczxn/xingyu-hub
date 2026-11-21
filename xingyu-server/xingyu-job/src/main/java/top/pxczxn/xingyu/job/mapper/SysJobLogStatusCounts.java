package top.pxczxn.xingyu.job.mapper;

import lombok.Data;

@Data
public class SysJobLogStatusCounts {

    private Long totalCount;
    private Long successCount;
    private Long failCount;
}
