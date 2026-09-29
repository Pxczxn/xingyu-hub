package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class SeriesView {
    String id;
    String title;
    String slug;
    String description;
    String status;
    long lockVersion;
    List<SeriesChapterView> chapters;
    Instant updatedAt;
}
