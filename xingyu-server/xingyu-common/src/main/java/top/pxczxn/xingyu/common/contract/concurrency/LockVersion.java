package top.pxczxn.xingyu.common.contract.concurrency;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LockVersion {
    long value;

    public static LockVersion initial() {
        return new LockVersion(0L);
    }

    public LockVersion next() {
        return new LockVersion(value + 1);
    }

    public boolean matches(long expected) {
        return value == expected;
    }
}
