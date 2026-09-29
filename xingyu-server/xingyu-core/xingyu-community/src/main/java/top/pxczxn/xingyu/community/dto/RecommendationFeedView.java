package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class RecommendationFeedView {
    String strategy;
    List<ContentCardView> items;
}
