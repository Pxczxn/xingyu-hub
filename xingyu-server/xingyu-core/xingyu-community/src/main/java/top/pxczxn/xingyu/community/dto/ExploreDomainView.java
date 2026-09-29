package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ExploreDomainView {
    String id;
    String slug;
    String name;
    String description;
    String icon;
    String parentId;
    String domainType;
    boolean personal;
    List<ExploreDomainView> children;
}
