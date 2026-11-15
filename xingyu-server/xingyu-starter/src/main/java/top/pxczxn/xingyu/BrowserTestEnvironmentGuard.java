package top.pxczxn.xingyu;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 浏览器测试进程的运行时隔离守卫。
 *
 * <p>放在主 classpath，并且只在 {@code browser-test} profile 下注册。它不读取配置文件里的
 * URL 文本，而是向已经建立的 JDBC 连接执行 {@code SELECT DATABASE()}，并向已经建立的
 * Redis 连接先命名再读取 {@code CLIENT LIST}，确认当前逻辑库。任一结果不符就终止启动。
 */
@Component
@Profile("browser-test")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BrowserTestEnvironmentGuard implements ApplicationRunner {

    static final String EXPECTED_DATABASE = "xingyu_hub_test";
    static final int EXPECTED_REDIS_DATABASE = 9;
    static final String REDIS_CONNECTION_NAME = "xingyu-browser-test-guard";
    private static final Set<String> FORBIDDEN_PROFILES = Set.of("dev", "prod", "test");
    private static final Pattern REDIS_DB = Pattern.compile("(?:^|\\s)db=(\\d+)(?:\\s|$)");

    private final Environment environment;
    private final JdbcTemplate jdbcTemplate;
    private final RedisConnectionFactory redisConnectionFactory;

    public BrowserTestEnvironmentGuard(
            Environment environment,
            JdbcTemplate jdbcTemplate,
            RedisConnectionFactory redisConnectionFactory) {
        this.environment = environment;
        this.jdbcTemplate = jdbcTemplate;
        this.redisConnectionFactory = redisConnectionFactory;
    }

    @Override
    public void run(ApplicationArguments args) {
        verify(environment, jdbcTemplate, redisConnectionFactory);
    }

    static void verify(
            Environment environment,
            JdbcTemplate jdbcTemplate,
            RedisConnectionFactory redisConnectionFactory) {
        verifyProfiles(environment.getActiveProfiles());
        verifyDatabase(jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        verifyRedisDatabase(currentRedisDatabase(redisConnectionFactory));
    }

    static void verifyProfiles(String[] activeProfiles) {
        Set<String> active = Set.copyOf(Arrays.asList(activeProfiles));
        if (!active.contains("browser-test")) {
            throw new IllegalStateException(
                    "浏览器测试守卫拒绝启动：当前 profile 不包含 browser-test，实际为 " + active);
        }
        for (String forbidden : FORBIDDEN_PROFILES) {
            if (active.contains(forbidden)) {
                throw new IllegalStateException(
                        "浏览器测试守卫拒绝启动：browser-test 不能与 " + forbidden + " 同时激活，实际为 " + active);
            }
        }
    }

    static void verifyDatabase(String actualDatabase) {
        if (!EXPECTED_DATABASE.equals(actualDatabase)) {
            throw new IllegalStateException(
                    "浏览器测试守卫拒绝启动：SELECT DATABASE() 返回 "
                            + actualDatabase
                            + "，预期 "
                            + EXPECTED_DATABASE);
        }
    }

    static void verifyRedisDatabase(int actualDatabase) {
        if (actualDatabase != EXPECTED_REDIS_DATABASE) {
            throw new IllegalStateException(
                    "浏览器测试守卫拒绝启动：Redis 当前逻辑库是 DB "
                            + actualDatabase
                            + "，预期 DB "
                            + EXPECTED_REDIS_DATABASE);
        }
    }

    static int currentRedisDatabase(RedisConnectionFactory redisConnectionFactory) {
        RedisConnection connection = redisConnectionFactory.getConnection();
        try {
            connection.execute(
                    "CLIENT",
                    "SETNAME".getBytes(StandardCharsets.UTF_8),
                    REDIS_CONNECTION_NAME.getBytes(StandardCharsets.UTF_8));
            String list = decode(connection.execute("CLIENT", "LIST".getBytes(StandardCharsets.UTF_8)));
            for (String line : list.split("\\R")) {
                if (!line.contains("name=" + REDIS_CONNECTION_NAME)) {
                    continue;
                }
                Matcher matcher = REDIS_DB.matcher(line);
                if (matcher.find()) {
                    return Integer.parseInt(matcher.group(1));
                }
            }
            throw new IllegalStateException("浏览器测试守卫拒绝启动：Redis CLIENT LIST 没有返回当前连接的逻辑库");
        } finally {
            connection.close();
        }
    }

    private static String decode(Object raw) {
        if (raw instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        if (raw instanceof String text) {
            return text;
        }
        throw new IllegalStateException("浏览器测试守卫拒绝启动：Redis CLIENT LIST 没有返回可读结果");
    }
}
