package top.pxczxn.xingyu.db.monitor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.cache.CacheKey;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Plugin;
import org.apache.ibatis.plugin.Signature;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Intercepts({
        @Signature(type = Executor.class, method = "query", args = {
                MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class
        }),
        @Signature(type = Executor.class, method = "query", args = {
                MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class, CacheKey.class, BoundSql.class
        }),
        @Signature(type = Executor.class, method = "update", args = {
                MappedStatement.class, Object.class
        })
})
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "xingyu.sql-monitor.enabled", havingValue = "true", matchIfMissing = true)
public class SqlMonitorInterceptor implements Interceptor {

    private final SqlMonitorReporter reporter;

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        Object[] args = invocation.getArgs();
        MappedStatement mappedStatement = (MappedStatement) args[0];
        Object parameter = args[1];
        BoundSql boundSql = args.length == 6 ? (BoundSql) args[5] : mappedStatement.getBoundSql(parameter);

        long startNanos = System.nanoTime();
        try {
            return invocation.proceed();
        } finally {
            try {
                long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;
                String displaySql = SqlDisplayFormatter.format(mappedStatement, boundSql);
                reporter.report(mappedStatement.getId(), displaySql, elapsedMs);
            } catch (Exception ex) {
                log.debug("SQL monitor logging skipped: {}", ex.getMessage());
            }
        }
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }
}
