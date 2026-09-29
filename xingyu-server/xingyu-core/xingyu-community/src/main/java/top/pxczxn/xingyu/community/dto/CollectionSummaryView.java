package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CollectionSummaryView {
    String id;
    String title;
    String visibility;
    long itemCount;
}
