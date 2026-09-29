package top.pxczxn.xingyu.web.advice;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
        }
        log.error("community api duplicate key", ex);
        return problem(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getTitle(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetails> handleOther(Exception ex, HttpServletRequest request) {
        log.error("community api error", ex);
        return problem(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getTitle(), request);
    }

    private ResponseEntity<ProblemDetails> problem(ErrorCode code, String detail, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        ProblemDetails body = ProblemDetails.of(code, detail, requestId);
        return ResponseEntity.status(code.getStatus()).body(body);
    }
}
