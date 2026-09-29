package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.OnboardingView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UserOnboarding;
import top.pxczxn.xingyu.community.mapper.UserOnboardingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final UserOnboardingMapper onboardingMapper;

    public OnboardingView get(CommunityUser user) {
        UserOnboarding onboarding = onboardingMapper.selectById(user.getId());
        if (onboarding == null) {
            return OnboardingView.builder()
                    .step("WELCOME")
                    .interestsJson(null)
                    .completed(false)
                    .build();
        }
        return toView(onboarding);
    }

    @Transactional
    public OnboardingView update(CommunityUser user, Map<String, Object> body) {
        UserOnboarding onboarding = onboardingMapper.selectById(user.getId());
        Instant now = Instant.now();
        if (onboarding == null) {
            onboarding = new UserOnboarding();
            onboarding.setUserId(user.getId());
            onboarding.setStep("WELCOME");
            onboarding.setCompleted(0);
            onboarding.setUpdatedAt(now);
        }
        if (body.containsKey("step")) {
            onboarding.setStep(String.valueOf(body.get("step")).trim());
        }
        if (body.containsKey("interestsJson")) {
            Object raw = body.get("interestsJson");
            onboarding.setInterestsJson(raw == null ? null : String.valueOf(raw));
        }
        if (body.containsKey("completed")) {
            Object raw = body.get("completed");
            boolean completed = raw instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(raw));
            onboarding.setCompleted(completed ? 1 : 0);
        }
        onboarding.setUpdatedAt(now);
        if (onboardingMapper.selectById(user.getId()) == null) {
            onboardingMapper.insert(onboarding);
        } else {
            onboardingMapper.updateById(onboarding);
        }
        return toView(onboarding);
    }

    private OnboardingView toView(UserOnboarding onboarding) {
        return OnboardingView.builder()
                .step(onboarding.getStep())
                .interestsJson(onboarding.getInterestsJson())
                .completed(onboarding.getCompleted() != null && onboarding.getCompleted() == 1)
                .build();
    }
}
