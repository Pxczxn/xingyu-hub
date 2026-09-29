package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SeriesChapterView {
    String id;
    String articleId;
    String title;
    int position;
}
