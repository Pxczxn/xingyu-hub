package top.pxczxn.xingyu.common.contract.concurrency;

import top.pxczxn.xingyu.common.contract.ErrorCode;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class IdempotencyResult<T> {
    IdempotencyStatus status;
    T response;
    ErrorCode errorCode;

    public enum IdempotencyStatus {
        CREATED,
        REPLAYED,
        CONFLICT
    }

    public static <T> IdempotencyResult<T> created(T response) {
        return IdempotencyResult.<T>builder().status(IdempotencyStatus.CREATED).response(response).build();
    }

    public static <T> IdempotencyResult<T> replayed(T response) {
        return IdempotencyResult.<T>builder().status(IdempotencyStatus.REPLAYED).response(response).build();
    }

    public static <T> IdempotencyResult<T> conflict() {
        return IdempotencyResult.<T>builder()
                .status(IdempotencyStatus.CONFLICT)
                .errorCode(ErrorCode.IDEMPOTENCY_CONFLICT)
                .build();
    }
}
