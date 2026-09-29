package top.pxczxn.xingyu.db.monitor;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "xingyu.sql-monitor")
public class SqlMonitorProperties {

    private boolean enabled = true;

    private int maxRecords = 100;

    private long warnThresholdMs = 500;

    private long slowThresholdMs = 1000;
}
