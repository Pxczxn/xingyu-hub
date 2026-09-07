package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SpaceWorksView {
    String username;
    String spaceSlug;
    String displayName;
    String description;
    boolean owner;
    List<CategorySummary> categories;
    List<WorkSummary> works;
    String nextCursor;

    @Value
    @Builder
    public static class CategorySummary {
        String id;
        String name;
        String slug;
    }

    @Value
    @Builder
    public static class WorkSummary {
        String id;
        String title;
        String categorySlug;
    }
}
