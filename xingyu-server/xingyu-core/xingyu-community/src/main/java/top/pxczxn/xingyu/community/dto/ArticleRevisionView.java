package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ArticleRevisionView {
    String id;
    int revisionNumber;
    String title;
    String summary;
    String visibility;
    Instant frozenAt;
}
