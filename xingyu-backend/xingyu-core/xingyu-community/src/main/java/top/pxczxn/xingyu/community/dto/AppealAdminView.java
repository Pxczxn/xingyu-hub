package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class AppealAdminView {
    String id;
    String caseId;
    String appellantId;
    String body;
    String status;
    String measureId;
    Instant createdAt;
}
