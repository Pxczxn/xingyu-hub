package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import top.pxczxn.xingyu.infra.schema.SchemaMigrator;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link SchemaMigrator} 的台账状态机契约（真库版，2026-10-11 随单连接改造适配）。
 *
 * <p>核心不变量（缺一即回归）：
 * <ol>
 *   <li><b>checksum 校验最先执行</b>——即使状态是 RECONCILED，checksum 不匹配
 *       也必须 fail-fast。</li>
 *   <li>SUCCESS / RECONCILED 都 skip，且<b>不执行迁移 SQL、不登记</b>。</li>
 *   <li>FAILED fail-fast。</li>
 *   <li>其它任意 status 一律 fail-fast。</li>
 *   <li>执行失败登记 FAILED 而非 SUCCESS；人工处置（清行）后幂等续传。</li>
 * </ol>
 *
 * <p>使用 test 库受控探针版本（{@value #VERSION}，正常迁移序列不会用的号段），
 * afterAll 清理台账与效果行；不污染真实迁移序列。
 */
class SchemaMigratorStatusTest {

    private static final String VERSION = "998";
    private static final String MIGRATION_FILE = "V" + VERSION + "__status_probe.sql";

    private static DataSource dataSource;
    private static Connection adminConn;

    @TempDir
    Path migrationDir;

    @BeforeAll
    static void openConnections() throws Exception {
        String adminUser = env("TEST_DB_ADMIN_USER");
        String adminPass = env("TEST_DB_ADMIN_PASSWORD");
        String url = "jdbc:mysql://127.0.0.1:3306/xingyu_hub_test?useUnicode=true&characterEncoding=utf8"
                + "&serverTimezone=GMT%2B8&allowMultiQueries=true";
        dataSource = buildDataSource(url, adminUser, adminPass);
        adminConn = DriverManager.getConnection(url, adminUser, adminPass);
        execAdmin("CREATE TABLE IF NOT EXISTS schema_migration (\n"
                + "  version varchar(8) NOT NULL PRIMARY KEY,\n"
                + "  checksum char(64) NOT NULL,\n"
                + "  status varchar(16) NOT NULL,\n"
                + "  applied_at timestamp NULL DEFAULT CURRENT_TIMESTAMP\n"
                + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    private static String env(String key) throws Exception {
        String fromEnv = System.getenv(key);
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv.trim();
        }
        Path envFile = Path.of("../../scripts/local-test-db.env").toAbsolutePath().normalize();
        if (!Files.exists(envFile)) {
            throw new IllegalStateException("missing " + key + " in environment and " + envFile);
        }
        for (String line : Files.readAllLines(envFile)) {
            if (line.startsWith(key + "=")) {
                return line.substring(key.length() + 1).replace("'", "").trim();
            }
        }
        throw new IllegalStateException("missing " + key + " in " + envFile);
    }

    private static DataSource buildDataSource(String url, String user, String password) {
        try {
            SimpleDriverDataSource ds = new SimpleDriverDataSource();
            ds.setDriverClass(com.mysql.cj.jdbc.Driver.class);
            ds.setUrl(url);
            ds.setUsername(user);
            ds.setPassword(password);
            java.util.Properties props = new java.util.Properties();
            props.setProperty("allowMultiQueries", "true");
            ds.setConnectionProperties(props);
            return ds;
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @AfterAll
    static void cleanup() throws Exception {
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        execAdmin("DROP TABLE IF EXISTS schema_status_probe");
        if (adminConn != null && !adminConn.isClosed()) {
            adminConn.close();
        }
    }

    private static void execAdmin(String sql) throws Exception {
        try (Statement stmt = adminConn.createStatement()) {
            stmt.execute(sql);
        }
    }

    /** 写入探针迁移文件并返回原始字节 SHA-256（与 SchemaMigrator 同口径）。 */
    private String writeProbe(String sql) throws Exception {
        Path script = migrationDir.resolve(MIGRATION_FILE);
        Files.writeString(script, sql, StandardCharsets.UTF_8);
        byte[] bytes = Files.readAllBytes(script);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private void resetProbe() throws Exception {
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        execAdmin("DROP TABLE IF EXISTS schema_status_probe");
    }

    private void seedLedger(String status, String checksum) throws Exception {
        resetProbe();
        try (PreparedStatement ps = adminConn.prepareStatement(
                "INSERT INTO schema_migration (version, checksum, status) VALUES (?, ?, ?)")) {
            ps.setString(1, VERSION);
            ps.setString(2, checksum);
            ps.setString(3, status);
            ps.executeUpdate();
        }
    }

    private int probeTableCount() throws Exception {
        try (Statement stmt = adminConn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
                             + " AND TABLE_NAME = 'schema_status_probe'")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private String ledgerStatus() throws Exception {
        return ledgerColumn("status");
    }

    private String ledgerChecksum() throws Exception {
        return ledgerColumn("checksum");
    }

    private String ledgerColumn(String column) throws Exception {
        try (Statement stmt = adminConn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT " + column + " FROM schema_migration WHERE version = '" + VERSION + "'")) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private SchemaMigrator migrator() {
        return new SchemaMigrator(dataSource, migrationDir.toString());
    }

    // ---- 状态机契约 ----

    @Test
    void successStatusMustSkipWithoutSideEffects() throws Exception {
        seedLedger("SUCCESS", writeProbe("CREATE TABLE schema_status_probe (id INT);\n"));
        int before = probeTableCount();

        migrator().run(null);

        assertEquals(before, probeTableCount(), "SUCCESS 必须跳过，不得重复执行");
        assertEquals("SUCCESS", ledgerStatus(), "台账状态不得被改写");
    }

    @Test
    void reconciledWithMatchingChecksumMustSkip() throws Exception {
        seedLedger("RECONCILED", writeProbe("CREATE TABLE schema_status_probe (id INT);\n"));
        int before = probeTableCount();

        migrator().run(null);

        assertEquals(before, probeTableCount(), "RECONCILED 必须跳过");
        assertEquals("RECONCILED", ledgerStatus(), "RECONCILED 不得被改写成 SUCCESS");
    }

    @Test
    void reconciledWithMismatchedChecksumMustFailFast() throws Exception {
        seedLedger("RECONCILED", "d".repeat(64));
        writeProbe("CREATE TABLE schema_status_probe (id INT);\n");
        int before = probeTableCount();

        Exception ex = assertThrows(Exception.class, () -> {
            try {
                migrator().run(null);
            } catch (Exception e) {
                throw e;
            }
        });

        assertTrue(ex.getMessage() != null && ex.getMessage().contains("Checksum mismatch"),
                "RECONCILED 不得放宽 checksum 校验，实际=" + ex.getMessage());
        assertEquals(before, probeTableCount());
    }

    @Test
    void failedStatusMustFailFastWithoutExecution() throws Exception {
        seedLedger("FAILED", writeProbe("CREATE TABLE schema_status_probe (id INT);\n"));
        int before = probeTableCount();

        Exception ex = assertThrows(Exception.class, () -> {
            try {
                migrator().run(null);
            } catch (Exception e) {
                throw e;
            }
        });

        assertTrue(ex.getMessage() != null && ex.getMessage().contains("previously failed"),
                "FAILED 必须 fail-fast（人工处置语义），实际=" + ex.getMessage());
        assertEquals(before, probeTableCount(), "FAILED 不得执行任何 SQL");
    }

    @Test
    void appliedMigrationRegistersSuccessWithFileChecksum() throws Exception {
        resetProbe();
        String checksum = writeProbe("CREATE TABLE schema_status_probe (id INT);\n");

        migrator().run(null);

        assertEquals("SUCCESS", ledgerStatus());
        // 幂等：第二次运行必须 skip 且不重复执行
        int tables = probeTableCount();
        migrator().run(null);
        assertEquals(tables, probeTableCount());
        assertEquals("SUCCESS", ledgerStatus());
        assertEquals(checksum, ledgerChecksum(), "登记 checksum 必须等于文件字节 SHA-256");
    }

    @Test
    void migrationSqlFailureRegistersFailedNotSuccess() throws Exception {
        // 异常中断不得错误登记 SUCCESS（坏 SQL → FAILED 登记 + 抛出）
        resetProbe();
        writeProbe("CREATE TABLE schema_status_probe (id INT); THIS IS NOT VALID SQL;\n");

        assertThrows(Exception.class, () -> migrator().run(null));

        assertEquals("FAILED", ledgerStatus(), "执行失败必须登记 FAILED，绝不能是 SUCCESS");
        // 人工处置模拟：清 FAILED 行后用正确 SQL 重跑 → SUCCESS（幂等续传）
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        writeProbe("CREATE TABLE IF NOT EXISTS schema_status_probe (id INT);\n");
        migrator().run(null);
        assertEquals("SUCCESS", ledgerStatus());
    }
}
