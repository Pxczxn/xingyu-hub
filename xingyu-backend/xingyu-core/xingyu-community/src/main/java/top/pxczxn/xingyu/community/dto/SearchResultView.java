package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SearchResultView {
    String objectType;
    String objectId;
    String title;
    String summary;
}
