package top.pxczxn.xingyu;

import cn.hutool.crypto.digest.BCrypt;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.core.security.DefaultAdminPasswordGuard;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 生产默认口令守卫相关断言。
 *
 * <p>说明：迁移基线为保留可复现的迁移链，种子数据里保留了 admin 的已知默认口令，
 * 因此 fresh 测试库**确实**存在默认口令账号 —— 这里既把它作为事实固化下来（审计结论），
 * 也验证守卫能准确识别与放行。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class DefaultAdminPasswordGuardTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ApplicationContext context;

    @Test
    void 非生产环境不注册守卫bean() {
        assertEquals(0, context.getBeanNamesForType(DefaultAdminPasswordGuard.class).length,
                "守卫仅在 prod profile 生效，不应影响 dev/test 启动行为");
    }

    @Test
    void fresh测试库确实保留了已知默认admin口令() {
        DefaultAdminPasswordGuard guard = new DefaultAdminPasswordGuard(jdbcTemplate);
        List<String> hits = guard.detectDefaultPasswordAccounts(List.of("admin123"));
        assertTrue(hits.stream().anyMatch(h -> h.startsWith("admin")),
                "审计结论：fresh 库 admin 仍使用默认口令 admin123，实际命中=" + hits);
    }

    @Test
    void 改成非默认口令后不再命中() {
        String original = jdbcTemplate.queryForObject(
                "SELECT password FROM sys_user WHERE username = 'admin'", String.class);
        try {
            String strong = BCrypt.hashpw("Xy9-" + System.nanoTime() + "-strong", BCrypt.gensalt());
            jdbcTemplate.update("UPDATE sys_user SET password = ? WHERE username = 'admin'", strong);

            DefaultAdminPasswordGuard guard = new DefaultAdminPasswordGuard(jdbcTemplate);
            List<String> hits = guard.detectDefaultPasswordAccounts(List.of("admin123", "123456", "admin"));
            assertFalse(hits.stream().anyMatch(h -> h.startsWith("admin")),
                    "口令已改为强随机值后不应再命中，实际命中=" + hits);
        } finally {
            jdbcTemplate.update("UPDATE sys_user SET password = ? WHERE username = 'admin'", original);
        }

        // 还原后应重新命中，证明上面的断言不是"永远不命中"的假阳性
        DefaultAdminPasswordGuard guard = new DefaultAdminPasswordGuard(jdbcTemplate);
        assertTrue(guard.detectDefaultPasswordAccounts(List.of("admin123"))
                        .stream().anyMatch(h -> h.startsWith("admin")),
                "还原后应重新命中");
    }
}
