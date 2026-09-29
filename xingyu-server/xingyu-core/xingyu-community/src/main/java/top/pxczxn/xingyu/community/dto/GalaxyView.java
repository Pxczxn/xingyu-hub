package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class GalaxyView {
    String id;
    String slug;
    String name;
    boolean official;
    long memberCount;
}
