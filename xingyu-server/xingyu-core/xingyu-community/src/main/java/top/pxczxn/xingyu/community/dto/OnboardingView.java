package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class OnboardingView {
    String step;
    String interestsJson;
    boolean completed;
}
