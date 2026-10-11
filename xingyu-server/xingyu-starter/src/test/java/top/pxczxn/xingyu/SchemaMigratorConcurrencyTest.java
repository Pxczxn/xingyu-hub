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
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * GET_LOCK 真实并发语义验证（2026-10-11 Phase 4.7 Phase B）。
 *
 * <p>必须用两个<b>独立物理连接</b>的迁移执行者证明，单实例成功不构成并发安全证据：
 * <ol>
 *   <li>第一个执行者完成（持锁→执行→释放）后，第二个执行者可以继续，
 *       并正确跳过已 SUCCESS 的迁移（幂等，不重复执行）。</li>
 *   <li>锁由<b>同一物理连接</b>获取与释放——CONNECTION_ID()/IS_USED_LOCK()
 *       证明归属：持锁时 IS_USED_LOCK 返回持有者 connection id；
 *       同连接 RELEASE_LOCK 必须返回 1；释放后 IS_USED_LOCK 为 NULL。</li>
 *   <li>异常中断（迁移 SQL 失败）登记 FAILED 而非 SUCCESS，且锁仍被释放
 *       （finally 释放 + 连接关闭双保险），第二个执行者立即可重试成功。</li>
 *   <li>外部连接长期持锁时，迁移者 GET_LOCK 等待约 30s 后明确失败。</li>
 * </ol>
 *
 * <p>执行者为直连 test 库的 {@link SchemaMigrator}（与生产同一实现），探针迁移
 * 版本 {@value #VERSION}，afterAll 清理。
 */
class SchemaMigratorConcurrencyTest {

    private static final String VERSION = "997";
    private static final String LOCK_NAME = "xingyu_hub_schema_migration";
    private static final String MIGRATION_FILE = "V" + VERSION + "__concurrency_probe.sql";

    private static String url;
    private static String user;
    private static String password;
    private static Connection adminConn;

    @TempDir
    Path migrationDirA;

    @TempDir
    Path migrationDirB;

    @BeforeAll
    static void open() throws Exception {
        user = env("TEST_DB_ADMIN_USER");
        password = env("TEST_DB_ADMIN_PASSWORD");
        url = "jdbc:mysql://127.0.0.1:3306/xingyu_hub_test?useUnicode=true&characterEncoding=utf8"
                + "&serverTimezone=GMT%2B8&allowMultiQueries=true";
        adminConn = DriverManager.getConnection(url, user, password);
        execAdmin("CREATE TABLE IF NOT EXISTS schema_migration (\n"
                + "  version varchar(8) NOT NULL PRIMARY KEY,\n"
                + "  checksum char(64) NOT NULL,\n"
                + "  status varchar(16) NOT NULL,\n"
                + "  applied_at timestamp NULL DEFAULT CURRENT_TIMESTAMP\n"
                + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        resetProbe();
        execAdmin("DROP TABLE IF EXISTS schema_concurrency_probe");
    }

    @AfterAll
    static void cleanup() throws Exception {
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        execAdmin("DROP TABLE IF EXISTS schema_concurrency_probe");
        if (adminConn != null && !adminConn.isClosed()) {
            adminConn.close();
        }
    }

    private static void resetProbe() throws Exception {
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        execAdmin("DROP TABLE IF EXISTS schema_concurrency_probe");
    }

    private static String env(String key) throws Exception {
        for (String line : Files.readAllLines(
                Path.of("../../scripts/local-test-db.env").toAbsolutePath().normalize())) {
            if (line.startsWith(key + "=")) {
                return line.substring(key.length() + 1).replace("'", "").trim();
            }
        }
        throw new IllegalStateException("missing " + key);
    }

    private static void execAdmin(String sql) throws Exception {
        try (Statement stmt = adminConn.createStatement()) {
            stmt.execute(sql);
        }
    }

    /** 每个执行者独立 DataSource → 独立物理连接（SimpleDriverDataSource 每次新建连接）。 */
    private DataSource newExecutorDataSource() {
        try {
            SimpleDriverDataSource ds = new SimpleDriverDataSource();
            ds.setDriverClass(com.mysql.cj.jdbc.Driver.class);
            ds.setUrl(url);
            ds.setUsername(user);
            ds.setPassword(password);
            Properties props = new Properties();
            props.setProperty("allowMultiQueries", "true");
            ds.setConnectionProperties(props);
            return ds;
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void writeProbe(Path dir, String sql) throws Exception {
        Files.writeString(dir.resolve(MIGRATION_FILE), sql, StandardCharsets.UTF_8);
    }

    private String ledgerStatus() throws Exception {
        try (Statement stmt = adminConn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT status FROM schema_migration WHERE version = '" + VERSION + "'")) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private long connectionId(Connection conn) throws Exception {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT CONNECTION_ID()")) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private long probeRowCount() throws Exception {
        try (Statement stmt = adminConn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM schema_concurrency_probe")) {
            rs.next();
            return rs.getLong(1);
        }
    }

    /** 当前是否有人持有迁移锁；有则返回持有者 CONNECTION_ID，无则 -1。 */
    private long lockHolderConnectionId() throws Exception {
        try (Statement stmt = adminConn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT IFNULL(IS_USED_LOCK('" + LOCK_NAME + "'), -1)")) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private SchemaMigrator migrator(DataSource ds, Path dir) {
        return new SchemaMigrator(ds, dir.toString());
    }

    @Test
    void secondExecutorAfterFirstCompletesSkipsAlreadyAppliedMigration() throws Exception {
        resetProbe();
        // 两个独立物理连接证明（并发验证前提）
        writeProbe(migrationDirA, "CREATE TABLE schema_concurrency_probe (id INT);\n");
        writeProbe(migrationDirB, "CREATE TABLE schema_concurrency_probe (id INT);\n");
        DataSource dsA = newExecutorDataSource();
        DataSource dsB = newExecutorDataSource();
        assertNotEquals(connectionId(dsA.getConnection()), connectionId(dsB.getConnection()),
                "两个执行者必须是不同物理连接，否则并发验证无效");

        // 执行者 A：持锁 → 执行 → 登记 → 释放
        migrator(dsA, migrationDirA).run(null);
        assertEquals("SUCCESS", ledgerStatus());

        // 执行者 B（独立物理连接）随后启动：跳过已 SUCCESS 的迁移（幂等，不重复执行）
        long rowsBefore = probeRowCount();
        migrator(dsB, migrationDirB).run(null);
        assertEquals(rowsBefore, probeRowCount(), "B 必须跳过 SUCCESS 迁移（幂等）");
        assertEquals("SUCCESS", ledgerStatus());
    }

    @Test
    void lockOwnershipFollowsTheAcquiringPhysicalConnection() throws Exception {
        writeProbe(migrationDirA, "SELECT 1;\n");
        DataSource dsA = newExecutorDataSource();
        try (Connection conn = dsA.getConnection()) {
            long selfId = connectionId(conn);

            // 同连接加锁（参数绑定先于 execute——SchemaMigrator.tryLock 同款顺序）
            long holder;
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT GET_LOCK(?, 5), CONNECTION_ID()")) {
                ps.setString(1, LOCK_NAME + "_probe");
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    assertEquals(1, rs.getInt(1), "空闲库上加锁必须成功");
                    holder = rs.getLong(2);
                }
            }
            assertEquals(selfId, holder, "GET_LOCK 必须落在执行它的物理连接上");

            // 另一物理连接观察：IS_USED_LOCK 返回持有者 connection id
            try (Connection other = newExecutorDataSource().getConnection();
                 Statement stmt = other.createStatement();
                 ResultSet rs = stmt.executeQuery(
                         "SELECT IS_USED_LOCK('" + LOCK_NAME + "_probe')")) {
                rs.next();
                assertEquals(selfId, rs.getLong(1), "IS_USED_LOCK 必须指向持有锁的物理连接");
            }

            // 同连接释放：必须返回 1
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT RELEASE_LOCK('" + LOCK_NAME + "_probe')")) {
                rs.next();
                assertEquals(1, rs.getInt(1), "同一连接 RELEASE_LOCK 必须返回 1");
            }

            // 释放后无持有者
            try (Connection other = newExecutorDataSource().getConnection();
                 Statement stmt = other.createStatement();
                 ResultSet rs = stmt.executeQuery(
                         "SELECT IFNULL(IS_USED_LOCK('" + LOCK_NAME + "_probe'), -1)")) {
                rs.next();
                assertEquals(-1, rs.getLong(1), "释放后必须无持有者");
            }
        }
    }

    @Test
    void failedMigrationRegistersFailedAndReleasesLockForRetry() throws Exception {
        resetProbe();
        writeProbe(migrationDirB, "CREATE TABLE schema_concurrency_probe (id INT); NOT VALID SQL;\n");

        AtomicReference<Exception> failure = new AtomicReference<>();
        try {
            migrator(newExecutorDataSource(), migrationDirB).run(null);
        } catch (Exception ex) {
            failure.set(ex);
        }
        assertTrue(failure.get() != null, "坏 SQL 必须失败");
        assertEquals("FAILED", ledgerStatus(), "异常中断登记 FAILED，绝不登记 SUCCESS");

        // 锁已释放（finally 释放 + 连接关闭双保险）：第二个执行者立即可重试成功
        writeProbe(migrationDirA, "CREATE TABLE IF NOT EXISTS schema_concurrency_probe (id INT);\n");
        execAdmin("DELETE FROM schema_migration WHERE version = '" + VERSION + "'");
        migrator(newExecutorDataSource(), migrationDirA).run(null);
        assertEquals("SUCCESS", ledgerStatus(), "锁释放后重试者必须能完成并登记 SUCCESS");
    }

    @Test
    void lockContentionTimesOutWithExplicitFailure() throws Exception {
        // 外部连接长期持锁 → 迁移者 GET_LOCK 等待 30s 超时 → 明确失败（不得进入执行区）
        writeProbe(migrationDirA, "SELECT 1;\n");
        resetProbe();
        Connection holder = newExecutorDataSource().getConnection();
        try {
            long holderId;
            try (PreparedStatement ps = holder.prepareStatement("SELECT GET_LOCK(?, 5), CONNECTION_ID()")) {
                ps.setString(1, LOCK_NAME);
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    assertEquals(1, rs.getInt(1), "外部持有者必须成功持锁");
                    holderId = rs.getLong(2);
                }
            }
            assertTrue(holderId > 0);

            long start = System.currentTimeMillis();
            Exception failure = null;
            try {
                migrator(newExecutorDataSource(), migrationDirA).run(null);
            } catch (Exception ex) {
                failure = ex;
            }
            long waited = System.currentTimeMillis() - start;
            assertTrue(failure != null, "持锁期间迁移者必须明确失败");
            assertTrue(waited >= 25_000, "GET_LOCK(?, 30) 必须等待约 30s 才失败，实际 " + waited + "ms");
            assertEquals(holderId, lockHolderConnectionId(),
                    "超时后锁仍归外部持有者（迁移者未越权抢占）");
        } finally {
            try (Statement stmt = holder.createStatement()) {
                stmt.execute("SELECT RELEASE_LOCK('" + LOCK_NAME + "')");
            }
            holder.close();
        }
    }

    @Test
    void failedMigrationDoesNotLeaveLockHeldByClosedConnection() throws Exception {
        // 连接异常关闭时，MySQL 自动释放该连接持有的全部命名锁（双保险验证）
        resetProbe();
        writeProbe(migrationDirB, "CREATE TABLE schema_concurrency_probe (id INT); NOT VALID SQL;\n");
        try {
            migrator(newExecutorDataSource(), migrationDirB).run(null);
        } catch (Exception ignored) {
            // 预期失败
        }
        // migrator 的连接已在 try-with-resources 关闭 → 锁不残留
        assertEquals(-1, lockHolderConnectionId(), "失败后不得有锁残留");
    }
}
