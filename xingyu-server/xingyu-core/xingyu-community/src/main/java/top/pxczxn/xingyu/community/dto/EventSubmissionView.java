package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class EventSubmissionView {
    String id;
    String eventId;
    String objectType;
    String objectId;
    String objectTitle;
    String note;
    String status;
    Instant createdAt;
}
