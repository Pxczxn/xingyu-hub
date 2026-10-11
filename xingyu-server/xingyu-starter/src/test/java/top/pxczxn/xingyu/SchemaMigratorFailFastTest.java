package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.infra.schema.SchemaMigrator;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SchemaMigrator 失败传播：迁移目录缺失必须向上抛出让应用 fail-fast，
 * 绝不能静默跳过迁移继续启动（否则 schema 落后会被当成健康状态）。
 * 数据源连接失败路径同样 fail-fast（bad URL 的 DataSource）。
 */
class SchemaMigratorFailFastTest {

    @Test
    void missingMigrationDirectoryMustFailFast() {
        Path missing = Path.of("target/definitely-missing-migration-dir");
        assertTrue(!Files.isDirectory(missing));

        SchemaMigrator migrator = new SchemaMigrator(
                org.springframework.jdbc.datasource.SimpleDriverDataSource.class.cast(
                        new org.springframework.jdbc.datasource.SimpleDriverDataSource()),
                missing.toString());

        assertThrows(IllegalStateException.class, () -> migrator.run(null),
                "迁移目录缺失必须 fail-fast，不得静默跳过");
    }

    @Test
    void brokenDataSourceMustFailFastOnConnection() {
        org.springframework.jdbc.datasource.SimpleDriverDataSource broken =
                new org.springframework.jdbc.datasource.SimpleDriverDataSource();
        try {
            broken.setDriverClass(com.mysql.cj.jdbc.Driver.class);
        } catch (Exception ignored) {
        }
        broken.setUrl("jdbc:mysql://127.0.0.1:1/never?connectTimeout=500&socketTimeout=500");
        broken.setUsername("nobody");
        broken.setPassword("nothing");

        SchemaMigrator migrator = new SchemaMigrator(broken, Path.of("sql").toAbsolutePath().normalize().toString());

        Exception ex = assertThrows(Exception.class, () -> migrator.run(null),
                "连接失败必须向上抛出（fail-fast），不得被误判为无迁移可执行");
        assertTrue(ex.getMessage() != null);
    }
}
