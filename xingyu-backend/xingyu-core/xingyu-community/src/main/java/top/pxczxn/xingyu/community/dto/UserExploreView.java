package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class UserExploreView {
    List<ExploreDomainView> domains;
    List<String> customLabels;
}
