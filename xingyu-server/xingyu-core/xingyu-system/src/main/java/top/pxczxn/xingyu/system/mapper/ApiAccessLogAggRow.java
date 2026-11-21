package top.pxczxn.xingyu.system.mapper;

import lombok.Data;

/**
 * One aggregated bucket for API access statistics: calendar date × path × method.
 */
@Data
public class ApiAccessLogAggRow {

    private String statDate;
    private String apiPath;
    private String method;
    private Long successCount;
    private Long failCount;
}
