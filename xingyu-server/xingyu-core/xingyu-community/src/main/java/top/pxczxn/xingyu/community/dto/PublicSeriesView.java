package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class PublicSeriesView {
    String id;
    String title;
    String slug;
    String description;
    List<SeriesChapterView> chapters;
    PublicIdentityView author;
}
