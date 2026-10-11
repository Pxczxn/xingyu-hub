package top.pxczxn.xingyu.common.exception;

import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.exception.NotPermissionException;
import cn.dev33.satoken.exception.NotRoleException;
import top.pxczxn.xingyu.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理
 */
@Slf4j
@RestControllerAdvice(basePackages = {
        "top.pxczxn.xingyu.admin",
        "top.pxczxn.xingyu.system",
        "top.pxczxn.xingyu.auth",
        "top.pxczxn.xingyu.file",
        "top.pxczxn.xingyu.gen",
        "top.pxczxn.xingyu.job"
})
public class GlobalExceptionHandler {

    /**
     * 业务异常
     */
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusinessException(BusinessException e) {
        log.error("业务异常: {}", e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    /**
     * 字段契约校验失败（admin 域此前无此分支：任何 @RequestBody 校验抛出的
     * FieldContractException 都落入 RuntimeException → 500。管理端错误惯例为
     * HTTP 200 + envelope code，故返回 code=400 让 admin 前端按既定方式提示。
     * 2026-10-10 Galaxy Identity 契约收口时补齐。）
     */
    @ExceptionHandler(top.pxczxn.xingyu.common.contract.FieldContractException.class)
    public Result<Void> handleFieldContractException(top.pxczxn.xingyu.common.contract.FieldContractException e) {
        log.warn("字段契约校验失败: {}", e.getMessage());
        return Result.fail(400, e.getMessage());
    }

    /**
     * 通用契约异常（admin 域 NOT_FOUND/CONFLICT 等），同上补齐，避免 500。
     */
    @ExceptionHandler(top.pxczxn.xingyu.common.contract.ContractException.class)
    public Result<Void> handleContractException(top.pxczxn.xingyu.common.contract.ContractException e) {
        log.warn("契约异常: {}", e.getMessage());
        return Result.fail(e.getErrorCode().getStatus().value(), e.getMessage());
    }

    /**
     * 未登录异常
     */
    @ExceptionHandler(NotLoginException.class)
    public Result<Void> handleNotLoginException(NotLoginException e) {
        log.error("未登录异常: {}", e.getMessage());
        return Result.fail(401, "请先登录");
    }

    /**
     * 无权限异常
     */
    @ExceptionHandler(NotPermissionException.class)
    public Result<Void> handleNotPermissionException(NotPermissionException e) {
        log.error("无权限异常: {}", e.getMessage());
        return Result.fail(403, "没有权限访问");
    }

    /**
     * 无角色异常
     */
    @ExceptionHandler(NotRoleException.class)
    public Result<Void> handleNotRoleException(NotRoleException e) {
        log.error("无角色异常: {}", e.getMessage());
        return Result.fail(403, "没有角色权限");
    }

    /**
     * 参数校验异常
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidException(MethodArgumentNotValidException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "参数校验失败";
        log.error("参数校验异常: {}", message);
        return Result.fail(400, message);
    }

    /**
     * 绑定异常
     */
    @ExceptionHandler(BindException.class)
    public Result<Void> handleBindException(BindException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "参数绑定失败";
        log.error("参数绑定异常: {}", message);
        return Result.fail(400, message);
    }

    /**
     * 运行时异常（业务逻辑抛出的异常）
     */
    @ExceptionHandler(RuntimeException.class)
    public Result<Void> handleRuntimeException(RuntimeException e) {
        log.warn("运行时异常: {}", e.getMessage());
        return Result.fail(e.getMessage());
    }

    /**
     * 非法参数异常
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("非法参数异常: {}", e.getMessage());
        return Result.fail(400, e.getMessage());
    }

    /**
     * 其他异常
     */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return Result.fail("系统繁忙，请稍后再试");
    }
}
