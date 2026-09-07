package top.pxczxn.xingyu.db.monitor;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "xingyu.sql-monitor.enabled", havingValue = "true", matchIfMissing = true)
public class SqlMonitorBootstrap {

    private final SqlMonitorProperties properties;

    @PostConstruct
    public void init() {
        log.info("XC SQL Monitor 已启用 | maxRecords={} | warn={}ms | slow={}ms",
                properties.getMaxRecords(),
                properties.getWarnThresholdMs(),
                properties.getSlowThresholdMs());
    }
}
