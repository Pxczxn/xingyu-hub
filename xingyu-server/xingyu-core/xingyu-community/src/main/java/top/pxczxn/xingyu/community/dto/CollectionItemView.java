package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CollectionItemView {
    String id;
    String title;
    String objectType;
    String objectId;
}
