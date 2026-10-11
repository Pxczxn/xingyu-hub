package top.pxczxn.xingyu.infra.schema;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;

import javax.sql.DataSource;

/**
 * SchemaMigrator 专用的迁移数据源（绕过运行时 Druid wall 防火墙）。
 *
 * <p>为什么必须独立于应用主池：wall filter 无条件拒绝 {@code PREPARE} 语句
 * （WallConfig 无对应开关），而幂等迁移（V041/V051 先例）依赖
 * {@code SET @var + PREPARE/EXECUTE} 形态——运行时 SQL 防火墙不该约束
 * 启动期受控 DDL 通道。2026-10-11 V050/V051 dev 执行时连续踩坑
 * （comment not allow → multi-statement not allow → MySqlPrepareStatement
 * not allow），最终以本配置收口。
 *
 * <p>台账机制（checksum/状态机/fail-fast）完全不变；安全影响可控：
 * 迁移文件是仓库内受控内容，应用流量仍走主池并受 wall 约束
 * （应用全部 PreparedStatement 参数化）。
 *
 * <p>仅当 {@code xingyu.schema.migration.enabled=true} 时创建——与
 * SchemaMigrator 同条件，默认（dev/test 配置显式 false）不存在。
 */
@Configuration
@ConditionalOnProperty(
        name = "xingyu.schema.migration.enabled",
        havingValue = "true",
        matchIfMissing = false)
public class MigrationDataSourceConfig {

    @Bean
    public DataSource schemaMigrationDataSource(Environment environment) {
        String url = environment.getProperty("spring.datasource.url");
        String username = environment.getProperty("spring.datasource.username");
        String password = environment.getProperty("spring.datasource.password");
        if (url == null || url.isBlank()) {
            throw new IllegalStateException(
                    "spring.datasource.url is not set; schema migration cannot run");
        }
        SimpleDriverDataSource dataSource = new SimpleDriverDataSource();
        // 驱动类由 url 推断（mysql-connector-j 注册自动驱动），SimpleDriverDataSource
        // 需要 Driver 实例——用 DriverShim 兼容多驱动场景会过度设计，这里直接反射加载。
        try {
            String driverClassName = environment.getProperty("spring.datasource.driver-class-name",
                    "com.mysql.cj.jdbc.Driver");
            dataSource.setDriverClass((Class<? extends java.sql.Driver>)
                    Class.forName(driverClassName));
        } catch (ClassNotFoundException ex) {
            throw new IllegalStateException("JDBC driver not found for schema migration", ex);
        }
        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        // 幂等迁移（V041/V051）是多语句文件（SET @var; PREPARE; EXECUTE;），
        // JDBC 驱动默认禁止一次 execute 多语句（第四次执行踩坑：syntax error near
        // 'SET @desc_missing'）。仅在迁移直连上开启，不影响应用主池。
        java.util.Properties props = new java.util.Properties();
        props.setProperty("allowMultiQueries", "true");
        dataSource.setConnectionProperties(props);
        return dataSource;
    }

    @Bean
    public JdbcTemplate schemaMigrationJdbcTemplate(DataSource schemaMigrationDataSource) {
        return new JdbcTemplate(schemaMigrationDataSource);
    }
}
