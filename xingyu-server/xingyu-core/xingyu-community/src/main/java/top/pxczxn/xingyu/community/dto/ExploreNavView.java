package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ExploreNavView {
    String mode;
    String sectionTitle;
    String feedHint;
    boolean canManage;
    List<ExploreNavTabView> domainTabs;
    List<DiscoverNavTabView> sortTabs;
}
