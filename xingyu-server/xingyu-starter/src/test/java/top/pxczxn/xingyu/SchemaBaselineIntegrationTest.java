package top.pxczxn.xingyu;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 测试库结构基线校验（专职用例）。
 *
 * <p>单独存在的意义：把"测试库是否等于 migration baseline"变成一条<b>始终会跑</b>的断言，
 * 而不是只在若干业务集成测试的 {@code @BeforeEach} 里顺带覆盖。这样即使某个业务测试被
 * 跳过或改名，结构漂移也不会被漏掉。
 *
 * <p>本测试只读 {@code information_schema}，不写库、不建表。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class SchemaBaselineIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("测试库结构与 migration baseline 一致（只读断言，不做任何自愈）")
    void testDatabaseMatchesMigrationBaseline() {
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
    }
}
