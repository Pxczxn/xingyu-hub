package top.pxczxn.xingyu.core.event;

import top.pxczxn.xingyu.common.contract.EventEnvelope;

@FunctionalInterface
public interface ReliableEventHandler {
    void handle(EventEnvelope envelope, String payloadJson) throws Exception;
}
