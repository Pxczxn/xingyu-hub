package top.pxczxn.xingyu.db.monitor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class SqlMonitorReporter {

    private final SqlMonitorStore store;
    private final SqlMonitorProperties properties;

    public void report(String mapperId, String sql, long elapsedMs) {
        String sqlType = SqlMonitorSupport.resolveSqlType(sql);
        String tableName = SqlMonitorSupport.extractTableName(sql);
        SqlMonitorLevel level = SqlMonitorSupport.resolveLevel(elapsedMs, properties);
        String normalizedSql = SqlMonitorSupport.normalizeSql(sql);

        SqlMonitorEntry entry = new SqlMonitorEntry(
                LocalDateTime.now(),
                mapperId,
                sqlType,
                tableName,
                normalizedSql,
                elapsedMs,
                level
        );
        store.add(entry);

        String coloredSql = SqlMonitorSupport.colorizeSql(normalizedSql, sqlType);
        String message = String.format(
                "%n%s %s %-6s │ 类型: %-8s │ 耗时: %4dms │ 表: %-15s │ Mapper: %s%nSQL: %s%n",
                level.color(),
                level.icon(),
                level.label(),
                sqlType,
                elapsedMs,
                tableName,
                mapperId,
                coloredSql
        ) + "\u001B[0m";

        if (level == SqlMonitorLevel.SLOW || level == SqlMonitorLevel.WARN) {
            log.warn(message);
        } else {
            log.info(message);
        }
    }
}
