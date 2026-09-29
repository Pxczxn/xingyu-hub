package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProblemDetails {
    String type;
    String title;
    int status;
    String detail;
    String code;
    String requestId;

    public static ProblemDetails of(ErrorCode errorCode, String detail, String requestId) {
        return ProblemDetails.builder()
                .type("about:blank")
                .title(errorCode.getTitle())
                .status(errorCode.getStatus().value())
                .detail(detail != null ? detail : errorCode.getTitle())
                .code(errorCode.getCode())
                .requestId(requestId)
                .build();
    }
}
