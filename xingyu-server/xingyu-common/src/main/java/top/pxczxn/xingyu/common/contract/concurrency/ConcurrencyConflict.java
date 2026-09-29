package top.pxczxn.xingyu.common.contract.concurrency;

import top.pxczxn.xingyu.common.contract.ErrorCode;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ConcurrencyConflict {
    ErrorCode errorCode;
    LockVersion currentVersion;
    String message;

    public static ConcurrencyConflict lockVersionMismatch(LockVersion current) {
        return ConcurrencyConflict.builder()
                .errorCode(ErrorCode.CONFLICT)
                .currentVersion(current)
                .message("资源已被他人更新")
                .build();
    }
}
