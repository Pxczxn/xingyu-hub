package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ErrorCode;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AccessDecision {
    boolean allowed;
    boolean discoverable;
    ErrorCode errorCode;

    public static AccessDecision allow(boolean discoverable) {
        return AccessDecision.builder().allowed(true).discoverable(discoverable).build();
    }

    public static AccessDecision deny(ErrorCode errorCode) {
        return AccessDecision.builder().allowed(false).discoverable(false).errorCode(errorCode).build();
    }
}
