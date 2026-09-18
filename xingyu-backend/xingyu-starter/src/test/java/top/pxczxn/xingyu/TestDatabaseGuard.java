package top.pxczxn.xingyu;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * 集成测试数据库安全守卫（fail-fast）。
 *
 * <p>背景：历史上集成测试直接跑在开发库 {@code xingyu_hub} 上，每次执行都会往开发库写入
 * 测试账号与业务数据。为避免该问题复发，凡是在测试作用域启动的 Spring 上下文，
 * 都必须在启动阶段确认自己连的是隔离的测试库，否则立即终止，绝不继续执行。
 *
 * <p>本类位于测试源码目录（src/test/java）且在被组件扫描的包 {@code top.pxczxn.xingyu} 下，
 * 因此会被所有 {@code @SpringBootTest} 上下文自动加载，测试类无需显式导入。
 * 顺序设为最高优先级，确保在任何数据写入（含迁移）之前就完成校验。
 *
 * <p>校验依据两条独立证据：
 * <ol>
 *   <li>JDBC 连接的 catalog（{@link Connection#getCatalog()}）；</li>
 *   <li>数据库服务端返回的当前库名 {@code SELECT DATABASE()}。</li>
 * </ol>
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TestDatabaseGuard implements ApplicationRunner {

    /** 集成测试唯一允许连接的数据库名。 */
    public static final String EXPECTED_DATABASE = "xingyu_hub_test";

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public TestDatabaseGuard(DataSource dataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String catalog;
        String jdbcUrl;
        try (Connection connection = dataSource.getConnection()) {
            catalog = connection.getCatalog();
            jdbcUrl = connection.getMetaData().getURL();
        }
        String actualDatabase = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);

        boolean catalogOk = EXPECTED_DATABASE.equals(catalog);
        boolean serverOk = EXPECTED_DATABASE.equals(actualDatabase);

        if (!catalogOk || !serverOk) {
            throw new IllegalStateException(buildFailureMessage(catalog, actualDatabase, jdbcUrl));
        }

        log.info("[TestDatabaseGuard] 数据库隔离校验通过：database={} url={}", actualDatabase, jdbcUrl);
    }

    private String buildFailureMessage(String catalog, String actualDatabase, String jdbcUrl) {
        String reason;
        if ("xingyu_hub".equals(actualDatabase) || "xingyu_hub".equals(catalog)) {
            reason = "检测到测试正连接开发库 xingyu_hub。";
        } else {
            reason = "连接库名与预期不一致。";
        }
        return """
                [TestDatabaseGuard] 集成测试数据库守卫校验失败，已终止测试以保护开发库。
                预期数据库 : %s
                catalog    : %s
                SELECT DATABASE() : %s
                JDBC URL   : %s
                %s
                处理方式：
                  1. 确认测试类使用 @ActiveProfiles("test")（而不是 "dev"）；
                  2. 确认 src/test/resources/application-test.yml 的 datasource 指向 %s；
                  3. 用 `bash scripts/rebuild-test-db.sh` 从迁移基线重建测试库。
                """.formatted(EXPECTED_DATABASE, catalog, actualDatabase, jdbcUrl, reason, EXPECTED_DATABASE);
    }
}
