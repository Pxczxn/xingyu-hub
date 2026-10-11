package top.pxczxn.xingyu.infra.schema;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Slf4j
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        name = "xingyu.schema.migration.enabled",
        havingValue = "true",
        matchIfMissing = true)
// 必须早于其它 ApplicationRunner：后续启动逻辑（含默认口令守卫）都依赖 schema 已就绪。
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SchemaMigrator implements ApplicationRunner {

    private static final Pattern VERSION_PATTERN = Pattern.compile("V(\\d+)__.*\\.sql");
    private static final String LOCK_NAME = "xingyu_hub_schema_migration";

    private final DataSource migrationDataSource;
    private final String migrationDir;

    /**
     * 迁移数据源独立于应用主池（绕过运行时 Druid wall 防火墙——wall 无条件拒绝
     * PREPARE 语句，而幂等迁移依赖 SET @var + PREPARE/EXECUTE），且连接参数
     * 开启 allowMultiQueries（幂等迁移是多语句文件）。
     *
     * <p><b>GET_LOCK 连接生命周期（2026-10-11 加固）</b>：GET_LOCK/RELEASE_LOCK
     * 是<b>连接级</b>锁——早前实现把三个操作分别交给池化 JdbcTemplate，每次
     * execute 都可能落在不同物理连接上，锁形同虚设。现改为在 {@link #run}
     * 中显式打开<b>单个</b> Connection：同一连接上加锁、逐个执行迁移、登记台账、
     * 释放锁，finally 关闭连接（连接关闭时 MySQL 也会自动释放其持有的全部命名锁，
     * 双保险）。不使用事务包裹：MySQL DDL 隐式提交，事务回滚不能撤销已执行的
     * 迁移，失败语义由台账 FAILED + 人工处置承担。
     */
    public SchemaMigrator(
            @Qualifier("schemaMigrationDataSource") DataSource migrationDataSource,
            @Value("${xingyu.schema.migration.dir:../sql}") String migrationDir) {
        this.migrationDataSource = migrationDataSource;
        this.migrationDir = migrationDir;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        List<Resource> scripts = loadVersionScripts();
        if (scripts.isEmpty()) {
            log.info("no migration scripts found in {}", migrationDir);
            return;
        }
        // 单个物理连接贯穿整个迁移批次：锁、执行、台账、释放全部同通道。
        try (Connection conn = migrationDataSource.getConnection()) {
            boolean ledgerExists = ledgerTableExists(conn);
            for (Resource script : scripts) {
                apply(conn, script, ledgerExists);
            }
        }
    }

    private List<Resource> loadVersionScripts() throws Exception {
        Path dir = resolveMigrationDir();
        if (!Files.isDirectory(dir)) {
            throw new IllegalStateException("Migration directory not found: " + dir);
        }
        try (Stream<Path> paths = Files.list(dir)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> VERSION_PATTERN.matcher(path.getFileName().toString()).matches())
                    .sorted(java.util.Comparator.comparingInt(path -> versionOf(path.getFileName().toString())))
                    .map(path -> (Resource) new FileSystemResource(path))
                    .toList();
        }
    }

    private Path resolveMigrationDir() {
        Path configured = Path.of(migrationDir);
        if (configured.isAbsolute()) {
            return configured.normalize();
        }
        Path fromCwd = Path.of(System.getProperty("user.dir")).resolve(configured).normalize();
        if (Files.isDirectory(fromCwd)) {
            return fromCwd;
        }
        Path current = Path.of(System.getProperty("user.dir"));
        for (int depth = 0; depth < 6 && current != null; depth++) {
            Path candidate = current.resolve("sql").resolve("versions");
            if (Files.isDirectory(candidate)) {
                return candidate.normalize();
            }
            current = current.getParent();
        }
        return fromCwd;
    }

    private int versionOf(String filename) {
        Matcher matcher = VERSION_PATTERN.matcher(filename);
        if (!matcher.matches()) {
            throw new IllegalStateException("Invalid migration file: " + filename);
        }
        return Integer.parseInt(matcher.group(1));
    }

    private void apply(Connection conn, Resource script, boolean ledgerExists) throws Exception {
        String filename = script.getFilename();
        String version = filename.substring(1, filename.indexOf("__"));
        String sql = new String(script.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String checksum = sha256(sql);

        if (ledgerExists) {
            List<String> statuses = queryList(conn,
                    "SELECT status FROM schema_migration WHERE version = ?", version);
            if (!statuses.isEmpty()) {
                String existingChecksum = queryOne(conn,
                        "SELECT checksum FROM schema_migration WHERE version = ?", version);
                if (!checksum.equals(existingChecksum)) {
                    // 唯一豁免：version=001 的原始文件已丢失，当前文件是按执行记录恢复的等价迁移。
                    // 兼容条件必须是"台账值 == 已登记历史 checksum"且"文件值 == 已固定新 checksum"，
                    // 二者同时成立才放行；其余任何版本或任何取值一律 fail-fast（见 LegacyMigrationChecksums）。
                    if (LegacyMigrationChecksums.isEquivalent(version, checksum, existingChecksum)) {
                        log.warn("schema version {} 命中 legacy checksum 兼容映射"
                                        + "（台账遗留 checksum={}，当前文件 checksum={}），视为同一历史迁移",
                                version, existingChecksum, checksum);
                    } else {
                        throw new IllegalStateException("Checksum mismatch for migration " + version);
                    }
                }
                // checksum 校验**先于**状态短路判断：否则"RECONCILED + 错 checksum"会被静默放过。
                //
                // 状态语义（三种，缺一不可）：
                //   SUCCESS    —— 该迁移确实被完整执行且未报错。
                //   RECONCILED —— 台账补偿记账：该迁移的**最终语义**经审计确认已满足
                //                 （dev 与 fresh 结构 0 diff + 关键 DML 后置条件成立），
                //                 但历史执行本身未经证实（原始 ledger 记录缺失，binlog 为 ROW 格式
                //                 无法还原 SQL 文本）。因此它**不是** SUCCESS 的同义词。
                //   FAILED     —— 曾经执行失败，必须人工处置。
                //
                // 其余任何取值一律 fail-fast：未知状态绝不允许进入锁、执行迁移，
                // 更不能落进下面的 catch 分支被改写成 FAILED（那会把审计结论污染成失败事实）。
                switch (statuses.get(0)) {
                    case "SUCCESS" -> {
                        log.info("skipped schema version {}", version);
                        return;
                    }
                    case "RECONCILED" -> {
                        log.info("skipped reconciled schema version {}", version);
                        return;
                    }
                    case "FAILED" -> throw new IllegalStateException(
                            "Migration " + version + " previously failed");
                    default -> throw new IllegalStateException(
                            "Unknown migration status '" + statuses.get(0) + "' for version " + version);
                }
            }
        }

        boolean locked = tryLock(conn);
        if (!locked) {
            throw new IllegalStateException("Could not acquire schema migration lock");
        }
        try {
            exec(conn, sql);
            update(conn,
                    "INSERT INTO schema_migration (version, checksum, status) VALUES (?, ?, 'SUCCESS') "
                            + "ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'SUCCESS', applied_at = CURRENT_TIMESTAMP",
                    version,
                    checksum);
            log.info("applied schema version {}", version);
        } catch (Exception ex) {
            update(conn,
                    "INSERT INTO schema_migration (version, checksum, status) VALUES (?, ?, 'FAILED') "
                            + "ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'FAILED'",
                    version,
                    checksum);
            throw ex;
        } finally {
            releaseLock(conn);
        }
    }

    /**
     * 判断 schema_migration 台账表是否存在。
     *
     * <p>刻意<b>不</b>捕获异常：只有"表确实不存在"才返回 false（进入首次迁移路径）。
     * 数据库连接失败、权限不足、SQL 语法/执行错误等任何其它异常都必须直接向上抛出
     * 让应用 fail-fast —— 否则会被误判成"这是个新库"，从而在新库路径上重复执行
     * 已应用的迁移，或在真正的故障下静默继续启动。
     */
    private boolean ledgerTableExists(Connection conn) throws SQLException {
        Long count = queryOne(conn,
                "SELECT COUNT(*) FROM information_schema.TABLES "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migration'");
        return count != null && count > 0;
    }

    private boolean tryLock(Connection conn) throws SQLException {
        // 返回第二列 CONNECTION_ID() 作为物理连接归属证据（并发测试与运维排查用）。
        // 注意：参数必须先于 executeQuery 绑定（try-with-resources 的资源初始化顺序
        // 曾导致 "No value specified for parameter 1"，2026-10-11 并发测试暴露）。
        try (PreparedStatement ps = conn.prepareStatement("SELECT GET_LOCK(?, 30), CONNECTION_ID()")) {
            ps.setString(1, LOCK_NAME);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long connectionId = rs.getLong(2);
                    log.info("schema migration lock acquired on physical connection id {}", connectionId);
                    int result = rs.getInt(1);
                    return !rs.wasNull() && result == 1;
                }
                return false;
            }
        }
    }

    private void releaseLock(Connection conn) {
        // 参数绑定顺序同 tryLock（先 setObject 后 executeQuery）。
        try (PreparedStatement ps = conn.prepareStatement("SELECT RELEASE_LOCK(?)")) {
            ps.setString(1, LOCK_NAME);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    // 返回 0=锁被其它连接持有、NULL=本连接根本没持有——两种都说明
                    // 锁归属与预期不符，必须告警（连接一致性的最后防线）。
                    int released = rs.getInt(1);
                    boolean wasNull = rs.wasNull();
                    if (wasNull || released != 1) {
                        log.warn("RELEASE_LOCK returned {} — lock ownership did not match the migration connection",
                                wasNull ? "NULL" : released);
                    }
                }
            }
        } catch (SQLException ex) {
            log.warn("release schema migration lock failed: {}", ex.getMessage());
        }
    }

    private List<String> queryList(Connection conn, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                List<String> out = new java.util.ArrayList<>();
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
                return out;
            }
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T queryOne(Connection conn, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? (T) rs.getObject(1) : null;
            }
        }
    }

    private void update(Connection conn, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            ps.executeUpdate();
        }
    }

    private void exec(Connection conn, String sql) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        }
    }

    private String sha256(String content) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(content.getBytes(StandardCharsets.UTF_8)));
    }
}
