package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class CollectionView {
    String id;
    String title;
    String description;
    String visibility;
    List<CollectionItemView> items;
}
