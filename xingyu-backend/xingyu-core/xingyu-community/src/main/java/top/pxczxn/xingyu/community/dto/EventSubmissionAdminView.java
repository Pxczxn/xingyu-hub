package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class EventSubmissionAdminView {
    String id;
    String eventId;
    String authorId;
    String authorUsername;
    String authorDisplayName;
    String objectType;
    String objectId;
    String objectTitle;
    String note;
    String status;
    Instant createdAt;
}
