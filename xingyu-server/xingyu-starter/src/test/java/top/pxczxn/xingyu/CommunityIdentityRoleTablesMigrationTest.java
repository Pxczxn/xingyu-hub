package top.pxczxn.xingyu;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V060 静态守卫：只读迁移文件，不连库、不改 schema。
 */
class CommunityIdentityRoleTablesMigrationTest {

    private static final String V059 = "V059__customer_and_file_config_master_index.sql";
    private static final String V060 = "V060__community_identity_role_tables.sql";

    @Test
    @DisplayName("V060 文件名排在 V059 之后")
    void v060FollowsV059() throws IOException {
        Path sqlDir = requireSqlDir();
        assertTrue(Files.isRegularFile(sqlDir.resolve(V059)), V059);
        assertTrue(Files.isRegularFile(sqlDir.resolve(V060)), V060);
        List<String> versions = listMigrationFiles(sqlDir).stream()
                .map(path -> path.getFileName().toString())
                .sorted(this::compareMigrationNames)
                .toList();
        int i059 = versions.indexOf(V059);
        int i060 = versions.indexOf(V060);
        assertTrue(i059 >= 0 && i060 == i059 + 1, "V060 必须紧跟 V059，实际顺序=" + versions.subList(
                Math.max(0, versions.size() - 4), versions.size()));
    }

    @Test
    @DisplayName("V060 只建两张表，含唯一约束与生成列，且无 DML")
    void v060DefinesTablesWithoutSeedData() throws IOException {
        String sql = Files.readString(requireSqlDir().resolve(V060));
        assertTrue(sql.contains("`community_user_role`"));
        assertTrue(sql.contains("`identity_verify_link`"));
        assertTrue(sql.contains("UNIQUE KEY `uk_community_user_role` (`community_user_id`, `role_id`)"));
        assertTrue(sql.contains("UNIQUE KEY `uk_identity_verify_link_active_community`"));
        assertTrue(sql.contains("UNIQUE KEY `uk_identity_verify_link_active_sys_user`"));
        assertTrue(sql.contains("GENERATED ALWAYS AS (CASE WHEN `status` = 'ACTIVE' THEN `community_user_id` ELSE NULL END) STORED"));
        assertTrue(sql.contains("GENERATED ALWAYS AS (CASE WHEN `status` = 'ACTIVE' THEN `sys_user_id` ELSE NULL END) STORED"));
        assertTrue(sql.contains("ON DELETE RESTRICT ON UPDATE RESTRICT"));
        assertTrue(sql.contains("fk_community_user_role_user"));
        assertTrue(sql.contains("fk_identity_verify_link_sys_user"));
        assertFalse(sql.contains("staff_grant_audit"));
        assertFalse(containsInsertInto(sql, "community_user_role"));
        assertFalse(containsInsertInto(sql, "identity_verify_link"));
        assertFalse(containsInsertInto(sql, "sys_user_role"));
    }

    @Test
    @DisplayName("回滚脚本只删除本批两张表")
    void rollbackDropsOnlyBatchTables() throws IOException {
        Path rollback = requireSqlDir().resolve("rollback").resolve("V060__drop_community_identity_role_tables.sql");
        assertTrue(Files.isRegularFile(rollback), rollback.toString());
        String sql = Files.readString(rollback);
        assertTrue(sql.contains("`identity_verify_link`"));
        assertTrue(sql.contains("`community_user_role`"));
        long dropLines = sql.lines().filter(line -> line.startsWith("DROP")).count();
        assertEquals(2, dropLines);
        assertFalse(sql.contains("`community_user`"));
        assertFalse(sql.contains("`sys_role`"));
        assertFalse(sql.contains("`sys_user`"));
    }

    private boolean containsInsertInto(String sql, String table) {
        Pattern pattern = Pattern.compile("(?i)INSERT\\s+INTO\\s+`?" + Pattern.quote(table) + "`?");
        Matcher matcher = pattern.matcher(sql);
        return matcher.find();
    }

    private int compareMigrationNames(String left, String right) {
        return Integer.compare(versionNumber(left), versionNumber(right));
    }

    private int versionNumber(String fileName) {
        Matcher matcher = Pattern.compile("^V(\\d+)__").matcher(fileName);
        assertTrue(matcher.find(), fileName);
        return Integer.parseInt(matcher.group(1));
    }

    private List<Path> listMigrationFiles(Path sqlDir) throws IOException {
        try (Stream<Path> paths = Files.list(sqlDir)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().matches("V\\d+__.*\\.sql"))
                    .toList();
        }
    }

    private Path requireSqlDir() {
        Optional<Path> dir = locateMigrationDir();
        assertTrue(dir.isPresent(), "未能找到 sql/ 目录，user.dir=" + Paths.get(System.getProperty("user.dir")));
        return dir.get();
    }

    private Optional<Path> locateMigrationDir() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        for (int depth = 0; depth < 5 && current != null; depth++) {
            Path candidate = current.resolve("sql");
            if (Files.isDirectory(candidate)) {
                return Optional.of(candidate);
            }
            current = current.getParent();
        }
        return Optional.empty();
    }
}
