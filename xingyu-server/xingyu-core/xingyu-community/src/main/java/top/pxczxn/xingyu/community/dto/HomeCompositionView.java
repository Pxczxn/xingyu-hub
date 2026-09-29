package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class HomeCompositionView {
    long unreadNotifications;
    List<SearchResultView> continueReading;
    List<SearchResultView> followingUpdates;
    List<SearchResultView> discoveries;
}
