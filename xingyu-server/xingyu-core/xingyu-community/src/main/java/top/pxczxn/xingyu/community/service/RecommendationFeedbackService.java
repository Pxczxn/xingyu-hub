package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.RecommendationFeedbackView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.RecommendationFeedback;
import top.pxczxn.xingyu.community.mapper.RecommendationFeedbackMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RecommendationFeedbackService {

    private final RecommendationFeedbackMapper feedbackMapper;

    public List<RecommendationFeedbackView> listMine(CommunityUser user, int limit) {
        int capped = Math.min(Math.max(limit, 1), 50);
        return feedbackMapper.listByUserId(user.getId(), capped).stream()
                .map(item -> new RecommendationFeedbackView(item.getId(), item.getBody(), item.getCreatedAt()))
                .toList();
    }

    @Transactional
    public RecommendationFeedbackView submit(CommunityUser user, String body) {
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isBlank()) {
            throw new FieldContractException("body", "反馈内容不能为空");
        }
        if (trimmed.length() > 2000) {
            throw new FieldContractException("body", "反馈内容不能超过 2000 字");
        }
        Instant now = Instant.now();
        RecommendationFeedback feedback = new RecommendationFeedback();
        feedback.setId(TokenSupport.newId());
        feedback.setUserId(user.getId());
        feedback.setBody(trimmed);
        feedback.setCreatedAt(now);
        feedbackMapper.insert(feedback);
        return new RecommendationFeedbackView(feedback.getId(), feedback.getBody(), feedback.getCreatedAt());
    }
}
