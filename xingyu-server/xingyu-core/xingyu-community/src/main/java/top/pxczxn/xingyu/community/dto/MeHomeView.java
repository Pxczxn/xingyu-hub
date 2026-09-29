package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class MeHomeView {
    List<ContentCardView> continueReading;
    List<ContentCardView> followUpdates;
    List<ContentCardView> recommendations;
    List<ContentCardView> draftArticles;
    List<PendingActionView> pendingActions;
}
