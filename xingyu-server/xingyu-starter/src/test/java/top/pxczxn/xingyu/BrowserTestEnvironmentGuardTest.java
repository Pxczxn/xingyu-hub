package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 守卫逻辑的进程内测试。这里使用桩连接，不启动 Spring、不连接本机 MySQL 或 Redis。
 */
class BrowserTestEnvironmentGuardTest {

    @Test
    void acceptsIsolatedBrowserTestProfile() {
        BrowserTestEnvironmentGuard.verify(
                environment("browser-test"),
                database("xingyu_hub_test"),
                redis("id=3 addr=127.0.0.1:1 name=xingyu-browser-test-guard flags=N db=9 sub=0\n"
                        + "id=4 name=other db=6"));
    }

    @Test
    void rejectsWrongDatabaseName() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () ->
                BrowserTestEnvironmentGuard.verify(
                        environment("browser-test"),
                        database("xingyu_hub"),
                        redis("db=9")));

        assertTrue(error.getMessage().contains("xingyu_hub"));
        assertTrue(error.getMessage().contains("xingyu_hub_test"));
    }

    @Test
    void rejectsRedisDatabaseOtherThanNine() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () ->
                BrowserTestEnvironmentGuard.verify(
                        environment("browser-test"),
                        database("xingyu_hub_test"),
                        redis("id=1 name=xingyu-browser-test-guard db=6 sub=0")));

        assertTrue(error.getMessage().contains("DB 6"));
        assertTrue(error.getMessage().contains("DB 9"));
    }

    @Test
    void rejectsMissingBrowserTestProfile() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () ->
                BrowserTestEnvironmentGuard.verifyProfiles(new String[]{"dev"}));

        assertTrue(error.getMessage().contains("browser-test"));
    }

    @Test
    void rejectsBrowserTestCombinedWithDev() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () ->
                BrowserTestEnvironmentGuard.verifyProfiles(new String[]{"browser-test", "dev"}));

        assertTrue(error.getMessage().contains("dev"));
    }

    @Test
    void redisInfoWithoutDatabaseIndexFailsClosed() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () ->
                BrowserTestEnvironmentGuard.currentRedisDatabase(
                        redis("id=1 name=xingyu-browser-test-guard flags=N sub=0")));

        assertTrue(error.getMessage().contains("CLIENT LIST"));
    }

    private static Environment environment(String... profiles) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles(profiles);
        return environment;
    }

    private static JdbcTemplate database(String name) {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(eq("SELECT DATABASE()"), eq(String.class))).thenReturn(name);
        return jdbcTemplate;
    }

    private static RedisConnectionFactory redis(String clientInfo) {
        RedisConnection connection = mock(RedisConnection.class);
        when(connection.execute(eq("CLIENT"), any(byte[].class)))
                .thenReturn(clientInfo.getBytes(StandardCharsets.UTF_8));
        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        when(factory.getConnection()).thenReturn(connection);
        return factory;
    }

    @Test
    void closesTheRedisConnectionAfterReadingIt() {
        RedisConnection connection = mock(RedisConnection.class);
        when(connection.execute(eq("CLIENT"), any(byte[].class)))
                .thenReturn("id=1 name=xingyu-browser-test-guard db=9".getBytes(StandardCharsets.UTF_8));
        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        when(factory.getConnection()).thenReturn(connection);

        assertEquals(9, BrowserTestEnvironmentGuard.currentRedisDatabase(factory));
        verify(connection).close();
    }
}
