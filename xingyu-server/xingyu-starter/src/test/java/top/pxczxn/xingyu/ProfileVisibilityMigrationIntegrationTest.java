package top.pxczxn.xingyu;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * V055 的数据谓词：只迁移从未保存过的注册默认 PRIVATE（lock_version=0），
 * 保留用户显式改过的 PRIVATE（lock_version>0）。
 *
 * <p>迁移文件本身由 {@code sql/rebuild-test-db.ps1} 在测试库重建时执行；这里用同一
 * 条 UPDATE 对两行夹具做行为断言，防止以后有人把条件改成“所有 PRIVATE 都迁移”或
 * “都不迁移”。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class ProfileVisibilityMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("V055 只迁移 lock_version=0 的历史默认 PRIVATE")
    void migrationOnlyNormalizesUntouchedDefaults() {
        String defaultUser = insertUser("migdefault");
        String defaultProfile = insertProfile(defaultUser, "migdefault", 0);
        String explicitUser = insertUser("migexplicit");
        String explicitProfile = insertProfile(explicitUser, "migexplicit", 1);

        jdbc.update("""
                UPDATE community_profile
                SET visibility = 'PUBLIC'
                WHERE visibility = 'PRIVATE'
                  AND lock_version = 0
                """);

        assertEquals("PUBLIC", visibilityOf(defaultProfile));
        assertEquals("PRIVATE", visibilityOf(explicitProfile));
    }

    private String insertUser(String prefix) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO community_user (id, email, password_hash, status, role, terms_version, created_at)
                VALUES (?, ?, 'x', 'ACTIVE', 'user', '1.0', NOW())
                """, id, prefix + "-" + id + "@example.com");
        return id;
    }

    private String insertProfile(String userId, String username, long lockVersion) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO community_profile
                    (id, user_id, username, display_name, visibility, followers_visibility, lock_version, created_at)
                VALUES (?, ?, ?, ?, 'PRIVATE', 'PRIVATE', ?, NOW())
                """, id, userId, username + id.replace("-", "").substring(0, 8), username, lockVersion);
        return id;
    }

    private String visibilityOf(String profileId) {
        String visibility = jdbc.queryForObject(
                "SELECT visibility FROM community_profile WHERE id = ?", String.class, profileId);
        assertNotNull(visibility);
        return visibility;
    }
}
