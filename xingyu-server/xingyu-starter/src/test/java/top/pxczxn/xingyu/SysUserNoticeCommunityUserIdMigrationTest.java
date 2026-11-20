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

class SysUserNoticeCommunityUserIdMigrationTest {

    private static final String V060 = "V060__community_identity_role_tables.sql";
    private static final String V061 = "V061__sys_user_notice_community_user_id.sql";

    @Test
    @DisplayName("V061 紧跟 V060，且是当前最大版本")
    void v061FollowsV060AndIsLatest() throws IOException {
        Path sqlDir = requireSqlDir();
        assertTrue(Files.isRegularFile(sqlDir.resolve(V060)), V060);
        assertTrue(Files.isRegularFile(sqlDir.resolve(V061)), V061);
        List<String> versions = listMigrationFiles(sqlDir).stream()
                .map(path -> path.getFileName().toString())
                .sorted(this::compareMigrationNames)
                .toList();
        int i060 = versions.indexOf(V060);
        int i061 = versions.indexOf(V061);
        assertTrue(i060 >= 0 && i061 == i060 + 1, "V061 必须紧跟 V060，实际顺序=" + versions.subList(
                Math.max(0, versions.size() - 4), versions.size()));
        assertEquals(V061, versions.getLast());
    }

    @Test
    @DisplayName("V061 只增加可空 community_user_id，不改历史 Long 行语义，无 DML")
    void v061AddsNullableCommunityUserIdWithoutDml() throws IOException {
        String sql = Files.readString(requireSqlDir().resolve(V061));
        assertTrue(sql.contains("`community_user_id`"));
        assertTrue(sql.contains("varchar(36)"));
        assertTrue(sql.contains("`sys_user_notice`"));
        assertTrue(sql.contains("uk_community_user_notice"));
        assertTrue(sql.contains("idx_sys_user_notice_community_user_id"));
        assertFalse(sql.contains("identity_verify_link"));
        assertFalse(Pattern.compile("(?i)INSERT\\s+INTO").matcher(sql).find());
        assertFalse(Pattern.compile("(?i)UPDATE\\s+`?sys_user_notice").matcher(sql).find());
    }

    @Test
    @DisplayName("回滚脚本删除本批列与索引")
    void rollbackDropsColumnAndIndexes() throws IOException {
        Path rollback = requireSqlDir().resolve("rollback").resolve("V061__drop_sys_user_notice_community_user_id.sql");
        assertTrue(Files.isRegularFile(rollback), rollback.toString());
        String sql = Files.readString(rollback);
        assertTrue(sql.contains("DROP COLUMN `community_user_id`"));
        assertTrue(sql.contains("uk_community_user_notice"));
        assertTrue(sql.contains("idx_sys_user_notice_community_user_id"));
        assertFalse(sql.contains("DROP TABLE"));
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
