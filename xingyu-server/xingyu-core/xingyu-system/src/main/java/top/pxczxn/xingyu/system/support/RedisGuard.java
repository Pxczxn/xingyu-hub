package top.pxczxn.xingyu.system.support;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import top.pxczxn.xingyu.common.exception.BusinessException;

import java.util.function.Supplier;

/**
 * 区分可选 Redis（缓存）与安全 Redis（验证码、登录锁、防重放）。
 *
 * <p>可选写入失败只记日志，不阻断启动或核心读路径。安全操作失败关闭，不把 Redis 故障当成“未命中”。
 */
@Slf4j
public final class RedisGuard {

    public static final String UNAVAILABLE_MESSAGE = "安全校验暂时不可用，请稍后重试";

    private RedisGuard() {
    }

    public static boolean isUnavailable(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof RedisConnectionFailureException
                    || current instanceof RedisSystemException
                    || current instanceof QueryTimeoutException) {
                return true;
            }
            String name = current.getClass().getName();
            if (name.startsWith("io.lettuce.core") || name.contains("Jedis")) {
                return true;
            }
        }
        return false;
    }

    public static void optional(Runnable action, String operation) {
        try {
            action.run();
        } catch (RuntimeException ex) {
            if (!isUnavailable(ex)) {
                throw ex;
            }
            log.warn("optional Redis {} skipped: {}", operation, ex.toString());
        }
    }

    public static <T> T required(Supplier<T> action, String operation) {
        try {
            return action.get();
        } catch (RuntimeException ex) {
            throw failClosed(operation, ex);
        }
    }

    public static void required(Runnable action, String operation) {
        required(() -> {
            action.run();
            return null;
        }, operation);
    }

    public static RuntimeException failClosed(String operation, Throwable error) {
        if (!isUnavailable(error)) {
            if (error instanceof RuntimeException runtime) {
                return runtime;
            }
            return new BusinessException(UNAVAILABLE_MESSAGE);
        }
        log.error("required Redis {} failed closed", operation);
        return new BusinessException(UNAVAILABLE_MESSAGE);
    }
}
