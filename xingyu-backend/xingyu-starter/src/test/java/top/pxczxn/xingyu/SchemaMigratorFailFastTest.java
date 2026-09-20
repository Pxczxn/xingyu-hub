package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import top.pxczxn.xingyu.infra.schema.SchemaMigrator;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * SchemaMigrator 的失败传播约束：判断 schema_migration 是否存在的查询，除"表确实不存在"外
 * 的任何异常都必须向上抛出让应用 fail-fast，绝不能被吞掉后误判成"这是个新库"。
 */
class SchemaMigratorFailFastTest {

    @Test
    void 迁移表查询遇到非不存在类异常必须failFast() {
        Path sqlDir = Path.of("../../sql").toAbsolutePath().normalize();
        assertTrue(Files.isDirectory(sqlDir), "测试需要能定位到仓库 sql 目录，实际=" + sqlDir);

        JdbcTemplate broken = mock(JdbcTemplate.class);
        // 模拟"数据库连接/权限/SQL 执行错误"，而不是"表不存在"
        when(broken.queryForObject(anyString(), eq(Integer.class)))
                .thenThrow(new DataAccessResourceFailureException("simulated connection failure"));

        SchemaMigrator migrator = new SchemaMigrator(broken, sqlDir.toString());

        assertThrows(DataAccessResourceFailureException.class, () -> migrator.run(null),
                "migrationTableExists 不得捕获异常后返回 false（否则会被误判为新库并继续启动）");
    }
}
