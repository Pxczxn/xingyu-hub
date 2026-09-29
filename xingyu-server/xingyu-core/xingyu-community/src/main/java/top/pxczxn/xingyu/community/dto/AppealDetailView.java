package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class AppealDetailView {
    String id;
    String caseId;
    String body;
    String status;
    Instant createdAt;
}
