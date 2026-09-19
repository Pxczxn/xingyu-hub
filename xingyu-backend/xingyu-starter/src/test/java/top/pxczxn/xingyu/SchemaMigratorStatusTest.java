package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import top.pxczxn.xingyu.infra.schema.SchemaMigrator;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link SchemaMigrator} 的台账状态机契约。
 *
 * <p>核心不变量（缺一即回归）：
 * <ol>
 *   <li><b>checksum 校验最先执行</b>——即使状态是 {@code RECONCILED}（补录记账），
 *       checksum 不匹配也必须 fail-fast，不得因为"状态已满足"而跳过校验。</li>
 *   <li>{@code SUCCESS} / {@code RECONCILED} 都 skip，且<b>不进入锁、不执行任何 SQL</b>。</li>
 *   <li>{@code FAILED} fail-fast。</li>
 *   <li><b>其它任意 status 一律 fail-fast</b>，绝不允许继续执行迁移——
 *       否则会重跑非幂等迁移并在 catch 分支把台账改写成 FAILED。</li>
 * </ol>
 *
 * <p>测试夹具刻意只放<b>一个</b>迁移文件到 {@link TempDir}，避免遍历仓库 {@code sql/} 的
 * 全部版本；checksum 由测试自己按文件字节算出，保证与被测代码同口径（SHA-256 over raw bytes）。
 */
class SchemaMigratorStatusTest {

    private static final String LOCK_NAME = "xingyu_hub_schema_migration";
    private static final String VERSION = "029";
    private static final String MIGRATION_FILE = "V" + VERSION + "__status_test.sql";

    @TempDir
    Path migrationDir;

    /** 写入唯一迁移文件并返回其原始字节的 SHA-256（与 SchemaMigrator 同口径）。 */
    private String writeMigrationAndComputeChecksum() throws Exception {
        Path script = migrationDir.resolve(MIGRATION_FILE);
        Files.writeString(script, "SELECT 1;\n", StandardCharsets.UTF_8);
        byte[] bytes = Files.readAllBytes(script);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    /**
     * 构造一个"schema_migration 已存在且该 version 有记录"的 JdbcTemplate。
     *
     * <p>GET_LOCK 故意返回 1：万一被测代码错误地越过状态判断走到锁，
     * 后续的 execute() 就会真的被触发，从而被 {@code never()} 断言抓住。
     */
    private JdbcTemplate ledgerWith(String status, String ledgerChecksum) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(1);
        when(jdbc.queryForList(anyString(), eq(String.class), anyString())).thenReturn(List.of(status));
        when(jdbc.queryForObject(anyString(), eq(String.class), anyString())).thenReturn(ledgerChecksum);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(LOCK_NAME))).thenReturn(1);
        return jdbc;
    }

    /** 必须一次 SQL 都没执行过。 */
    private void assertNoMigrationExecuted(JdbcTemplate jdbc) {
        verify(jdbc, never()).execute(anyString());
    }

    /** 必须连迁移锁都没碰过（说明是在状态判断处就返回/抛出了）。 */
    private void assertNeverEnteredLock(JdbcTemplate jdbc) {
        verify(jdbc, never()).queryForObject(contains("GET_LOCK"), eq(Integer.class), eq(LOCK_NAME));
    }

    // ------------------------------------------------------------------
    // RECONCILED
    // ------------------------------------------------------------------

    @Test
    void reconciledWithMatchingChecksumMustSkipAndNeverExecuteSql() throws Exception {
        String checksum = writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith("RECONCILED", checksum);

        new SchemaMigrator(jdbc, migrationDir.toString()).run(null);

        assertNoMigrationExecuted(jdbc);
        assertNeverEnteredLock(jdbc);
    }

    @Test
    void reconciledWithMismatchedChecksumMustFailFastAsChecksumMismatch() throws Exception {
        writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith("RECONCILED", "d".repeat(64));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new SchemaMigrator(jdbc, migrationDir.toString()).run(null));

        assertTrue(ex.getMessage().contains("Checksum mismatch"),
                "RECONCILED 不得放宽 checksum 校验，实际消息=" + ex.getMessage());
        assertNoMigrationExecuted(jdbc);
        assertNeverEnteredLock(jdbc);
    }

    // ------------------------------------------------------------------
    // 未知 status
    // ------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "ROLLED_BACK", "RECONCILE", "reconciled", "SUCCESS ", ""})
    void unknownStatusMustFailFastWithoutLockOrExecution(String status) throws Exception {
        String checksum = writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith(status, checksum);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new SchemaMigrator(jdbc, migrationDir.toString()).run(null));

        assertTrue(ex.getMessage().contains("Unknown migration status"),
                "未知 status 必须 fail-fast，实际消息=" + ex.getMessage());
        assertTrue(ex.getMessage().contains(status),
                "异常消息应带上原始 status，实际消息=" + ex.getMessage());
        assertNoMigrationExecuted(jdbc);
        assertNeverEnteredLock(jdbc);
    }

    // ------------------------------------------------------------------
    // 既有行为回归
    // ------------------------------------------------------------------

    @Test
    void successMustSkipAndNeverExecuteSql() throws Exception {
        String checksum = writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith("SUCCESS", checksum);

        new SchemaMigrator(jdbc, migrationDir.toString()).run(null);

        assertNoMigrationExecuted(jdbc);
        assertNeverEnteredLock(jdbc);
    }

    @Test
    void failedMustFailFast() throws Exception {
        String checksum = writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith("FAILED", checksum);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new SchemaMigrator(jdbc, migrationDir.toString()).run(null));

        assertTrue(ex.getMessage().contains("previously failed"),
                "FAILED 必须 fail-fast，实际消息=" + ex.getMessage());
        assertNoMigrationExecuted(jdbc);
        assertNeverEnteredLock(jdbc);
    }

    @Test
    void failedWithMismatchedChecksumStillReportsChecksumMismatchFirst() throws Exception {
        writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = ledgerWith("FAILED", "d".repeat(64));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new SchemaMigrator(jdbc, migrationDir.toString()).run(null));

        assertTrue(ex.getMessage().contains("Checksum mismatch"),
                "checksum 校验必须先于状态判断，实际消息=" + ex.getMessage());
        assertNoMigrationExecuted(jdbc);
    }

    // ------------------------------------------------------------------
    // 首次迁移路径不受影响
    // ------------------------------------------------------------------

    @Test
    void ledgerTableMissingStillAppliesMigration() throws Exception {
        writeMigrationAndComputeChecksum();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(0);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(LOCK_NAME))).thenReturn(1);

        new SchemaMigrator(jdbc, migrationDir.toString()).run(null);

        verify(jdbc).execute("SELECT 1;\n");
    }
}
