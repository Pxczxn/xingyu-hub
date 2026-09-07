package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class GalaxyContentView {
    String id;
    String objectType;
    String objectId;
    String title;
    boolean pinned;
}
