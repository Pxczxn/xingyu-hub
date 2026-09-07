package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ModerationCaseView {
    String id;
    String reportId;
    String status;
    String objectType;
    String objectId;
    String reason;
    Instant createdAt;
}
