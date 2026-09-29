package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SpacePublicView {
    String spaceSlug;
    String displayName;
    String description;
    String ownerUsername;
    List<SpaceWorksView.CategorySummary> categories;
}
