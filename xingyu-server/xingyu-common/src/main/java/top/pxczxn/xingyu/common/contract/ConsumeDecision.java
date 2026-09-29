package top.pxczxn.xingyu.common.contract;

/**
 * 事件消费决策。
 */
public enum ConsumeDecision {
    ACCEPT,
    RETRY,
    ISOLATE;

    public static ConsumeDecision forEventVersion(int consumerSchemaVersion, int eventVersion) {
        if (eventVersion <= 0) {
            return ISOLATE;
        }
        if (eventVersion <= consumerSchemaVersion) {
            return ACCEPT;
        }
        if (eventVersion == consumerSchemaVersion + 1) {
            return ACCEPT;
        }
        return ISOLATE;
    }
}
