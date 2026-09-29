package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CategoryView {
    String id;
    String name;
    String slug;
    String status;
    long lockVersion;
    int sortOrder;
}
