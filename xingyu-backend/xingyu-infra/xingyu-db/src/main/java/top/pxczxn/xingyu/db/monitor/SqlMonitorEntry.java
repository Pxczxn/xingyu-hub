package top.pxczxn.xingyu.db.monitor;

import java.time.LocalDateTime;

public record SqlMonitorEntry(
        LocalDateTime timestamp,
        String mapperId,
        String sqlType,
        String tableName,
        String sql,
        long elapsedMs,
        SqlMonitorLevel level) {
}
