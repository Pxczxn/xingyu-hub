package top.pxczxn.xingyu.web.advice;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestControllerAdvice(basePackages = "top.pxczxn.xingyu.web.controller")
public class CommunityApiExceptionHandler {

    @ExceptionHandler(FieldContractException.class)
    public ResponseEntity<ProblemDetails> handleField(FieldContractException ex, HttpServletRequest request) {
        return problem(ex.getErrorCode(), ex.getDetail(), request);
    }

    @ExceptionHandler(ContractException.class)
    public ResponseEntity<ProblemDetails> handleContract(ContractException ex, HttpServletRequest request) {
        return problem(ex.getErrorCode(), ex.getDetail(), request);
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ProblemDetails> handleDuplicateKey(DuplicateKeyException ex, HttpServletRequest request) {
        String message = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        if (message != null) {
            if (message.contains("uk_community_profile_username")
                    || message.contains("uk_community_space_slug")
                    || message.contains("username_history")) {
                return problem(ErrorCode.VALIDATION_FAILED, "username: 用户名已被占用", request);
            }
            if (message.contains("uk_community_user_email")) {
                return problem(ErrorCode.VALIDATION_FAILED, "email: 邮箱不可用", request);
            }
            if (message.contains("uk_event_registration")) {
                // 并发报名撞唯一约束：业务上等价于"已报名"，返回 409 冲突语义而非 500。
                return problem(ErrorCode.CONFLICT, "已经报名该活动", request);
            }
        }
        log.error("community api duplicate key", ex);
        return problem(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getTitle(), request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemDetails> handleResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        if (status.is5xxServerError()) {
            log.error("community api response status", ex);
        }
        ErrorCode code = errorCodeFor(status);
        String detail = ex.getReason() != null ? ex.getReason() : code.getTitle();
        return problem(code, detail, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetails> handleOther(Exception ex, HttpServletRequest request) {
        log.error("community api error", ex);
        return problem(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getTitle(), request);
    }

    private static ErrorCode errorCodeFor(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> ErrorCode.VALIDATION_FAILED;
            case UNAUTHORIZED -> ErrorCode.AUTH_REQUIRED;
            case FORBIDDEN -> ErrorCode.AUTH_FORBIDDEN;
            case NOT_FOUND -> ErrorCode.NOT_FOUND;
            case CONFLICT -> ErrorCode.CONFLICT;
            default -> status.is4xxClientError() ? ErrorCode.VALIDATION_FAILED : ErrorCode.INTERNAL_ERROR;
        };
    }

    private ResponseEntity<ProblemDetails> problem(ErrorCode code, String detail, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        ProblemDetails body = ProblemDetails.of(code, detail, requestId);
        return ResponseEntity.status(code.getStatus()).body(body);
    }
}
