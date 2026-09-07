package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscoverNavTabView {
    String key;
    String label;
    boolean defaultSelected;
}
