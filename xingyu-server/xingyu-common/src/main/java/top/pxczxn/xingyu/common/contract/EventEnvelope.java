package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Value;

/**
 * 跨域事件信封：不含正文或凭据，仅携带元数据。
 */
@Value
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EventEnvelope {
    String eventId;
    String eventType;
    int eventVersion;
    String aggregateType;
    ObjectId aggregateId;
    InstantUtc occurredAt;
    String correlationId;
    String causationId;
    int consumerSchemaVersion;
}
