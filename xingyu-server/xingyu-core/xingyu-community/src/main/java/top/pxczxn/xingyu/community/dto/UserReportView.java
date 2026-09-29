package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class UserReportView {
    String id;
    String status;
    String targetType;
    String targetId;
    Instant updatedAt;
}
