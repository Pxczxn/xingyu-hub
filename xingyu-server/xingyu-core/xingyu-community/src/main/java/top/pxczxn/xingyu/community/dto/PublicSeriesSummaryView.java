package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PublicSeriesSummaryView {
    String id;
    String title;
    String slug;
    String description;
    int chapterCount;
    PublicIdentityView author;
}
