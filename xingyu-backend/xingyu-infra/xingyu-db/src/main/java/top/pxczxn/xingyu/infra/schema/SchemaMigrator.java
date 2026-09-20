package top.pxczxn.xingyu.infra.schema;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Comparator;
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

    private final JdbcTemplate jdbcTemplate;
    private final String migrationDir;

    public SchemaMigrator(
            JdbcTemplate jdbcTemplate,
            @Value("${xingyu.schema.migration.dir:../sql}") String migrationDir) {
        this.jdbcTemplate = jdbcTemplate;
        this.migrationDir = migrationDir;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        List<Resource> scripts = loadVersionScripts();
        for (Resource script : scripts) {
            apply(script);
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
                    .sorted(Comparator.comparingInt(path -> versionOf(path.getFileName().toString())))
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

    private void apply(Resource script) throws Exception {
        String filename = script.getFilename();
        String version = filename.substring(1, filename.indexOf("__"));
        String sql = new String(script.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String checksum = sha256(sql);

        if (migrationTableExists()) {
            List<String> statuses = jdbcTemplate.queryForList(
                    "SELECT status FROM schema_migration WHERE version = ?",
                    String.class,
                    version);
            if (!statuses.isEmpty()) {
                String existingChecksum = jdbcTemplate.queryForObject(
                        "SELECT checksum FROM schema_migration WHERE version = ?",
                        String.class,
                        version);
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

        boolean locked = tryLock();
        if (!locked) {
            throw new IllegalStateException("Could not acquire schema migration lock");
        }
        try {
            jdbcTemplate.execute(sql);
            jdbcTemplate.update(
                    "INSERT INTO schema_migration (version, checksum, status) VALUES (?, ?, 'SUCCESS') "
                            + "ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'SUCCESS', applied_at = CURRENT_TIMESTAMP",
                    version,
                    checksum);
            log.info("applied schema version {}", version);
        } catch (Exception ex) {
            jdbcTemplate.update(
                    "INSERT INTO schema_migration (version, checksum, status) VALUES (?, ?, 'FAILED') "
                            + "ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'FAILED'",
                    version,
                    checksum);
            throw ex;
        } finally {
            releaseLock();
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
    private boolean migrationTableExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migration'",
                Integer.class);
        return count != null && count > 0;
    }

    private boolean tryLock() {
        Integer result = jdbcTemplate.queryForObject("SELECT GET_LOCK(?, 30)", Integer.class, LOCK_NAME);
        return result != null && result == 1;
    }

    private void releaseLock() {
        jdbcTemplate.queryForObject("SELECT RELEASE_LOCK(?)", Integer.class, LOCK_NAME);
    }

    private String sha256(String content) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(content.getBytes(StandardCharsets.UTF_8)));
    }
}
