package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class DiscoverNavView {
    List<DiscoverNavTabView> typeTabs;
    List<DiscoverNavTabView> sortTabs;
}
