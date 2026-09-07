package top.pxczxn.xingyu.common.contract;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    VALIDATION_FAILED("VALIDATION_FAILED", HttpStatus.BAD_REQUEST, "请求参数无效"),
    AUTH_INVALID_CREDENTIALS("AUTH_INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED, "邮箱或密码错误"),
    AUTH_REQUIRED("AUTH_REQUIRED", HttpStatus.UNAUTHORIZED, "请先登录"),
    AUTH_FORBIDDEN("AUTH_FORBIDDEN", HttpStatus.FORBIDDEN, "无权访问"),
    NOT_FOUND("NOT_FOUND", HttpStatus.NOT_FOUND, "资源不存在"),
    CONFLICT("CONFLICT", HttpStatus.CONFLICT, "请求冲突"),
    IDEMPOTENCY_CONFLICT("IDEMPOTENCY_CONFLICT", HttpStatus.CONFLICT, "幂等键冲突"),
    EMAIL_TOKEN_INVALID("EMAIL_TOKEN_INVALID", HttpStatus.BAD_REQUEST, "验证链接无效或已过期"),
    ACCOUNT_SUSPENDED("ACCOUNT_SUSPENDED", HttpStatus.FORBIDDEN, "账号已停用"),
    INTERNAL_ERROR("INTERNAL_ERROR", HttpStatus.INTERNAL_SERVER_ERROR, "系统繁忙，请稍后再试");

    private final String code;
    private final HttpStatus status;
    private final String title;
}
