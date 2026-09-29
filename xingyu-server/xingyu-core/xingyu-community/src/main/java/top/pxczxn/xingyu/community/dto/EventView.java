package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class EventView {
    String id;
    String slug;
    String title;
    String body;
    Instant startsAt;
    Instant endsAt;
    boolean submissionOpen;
}
