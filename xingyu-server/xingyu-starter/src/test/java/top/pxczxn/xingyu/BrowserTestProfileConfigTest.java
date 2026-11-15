package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 用 Spring 的 YAML 加载器读取主 classpath 配置。不创建 ApplicationContext，也不打开端口。
 */
class BrowserTestProfileConfigTest {

    @Test
    void browserTestProfileBindsIsolatedResources() throws Exception {
        PropertySource<?> source = load("application-browser-test.yml");
        String text = Files.readString(mainResource("application-browser-test.yml"), StandardCharsets.UTF_8);

        assertEquals(7789, source.getProperty("server.port"));
        assertEquals(9, source.getProperty("spring.data.redis.database"));
        assertEquals(false, source.getProperty("xingyu.schema.migration.enabled"));
        assertEquals(false, source.getProperty("xingyu.sql-monitor.enabled"));
        assertTrue(String.valueOf(source.getProperty("spring.datasource.url")).contains("/xingyu_hub_test?"));
        assertEquals("${TEST_DB_USERNAME:xingyu_test}", source.getProperty("spring.datasource.username"));
        assertEquals("${TEST_DB_PASSWORD}", source.getProperty("spring.datasource.password"));
        assertFalse(text.contains("local-db.properties"));
        assertFalse(text.contains("${DB_PASSWORD"));
        assertFalse(text.contains("${DB_USERNAME"));
        assertFalse(text.contains("spring.profiles.active"));
        assertFalse(text.contains("/xingyu_hub?"));
    }

    @Test
    void devAndTestProfilesStayOnTheirOwnResources() throws Exception {
        PropertySource<?> dev = load("application-dev.yml");
        PropertySource<?> prod = load("application-prod.yml");
        PropertySource<?> test = loadTestResource();

        assertEquals(7779, dev.getProperty("server.port"));
        assertTrue(String.valueOf(dev.getProperty("spring.datasource.url")).contains("/xingyu_hub?"));
        assertEquals(6, dev.getProperty("spring.data.redis.database"));
        assertTrue(String.valueOf(dev.getProperty("spring.datasource.password")).contains("DB_PASSWORD"));

        assertTrue(String.valueOf(prod.getProperty("spring.datasource.url")).contains("xingyu_hub"));
        assertEquals("${REDIS_DATABASE:6}", prod.getProperty("spring.data.redis.database"));

        assertEquals(0, test.getProperty("server.port"));
        assertEquals(7, test.getProperty("spring.data.redis.database"));
        assertTrue(String.valueOf(test.getProperty("spring.datasource.url")).contains("xingyu_hub_test"));
    }

    private static PropertySource<?> load(String fileName) throws Exception {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load(fileName, new FileSystemResource(mainResource(fileName)));
        assertEquals(1, sources.size());
        return sources.get(0);
    }

    private static PropertySource<?> loadTestResource() throws Exception {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application-test.yml", new ClassPathResource("application-test.yml"));
        assertEquals(1, sources.size());
        return sources.get(0);
    }

    private static Path mainResource(String fileName) {
        return Path.of("src/main/resources").resolve(fileName);
    }
}
