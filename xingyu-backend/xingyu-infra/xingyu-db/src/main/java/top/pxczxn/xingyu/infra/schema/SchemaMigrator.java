package top.pxczxn.xingyu.infra.schema;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
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
                    throw new IllegalStateException("Checksum mismatch for migration " + version);
                }
                if ("SUCCESS".equals(statuses.get(0))) {
                    log.info("skipped schema version {}", version);
                    return;
                }
                if ("FAILED".equals(statuses.get(0))) {
                    throw new IllegalStateException("Migration " + version + " previously failed");
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

    private boolean migrationTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM schema_migration", Integer.class);
            return true;
        } catch (Exception ex) {
            return false;
        }
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
