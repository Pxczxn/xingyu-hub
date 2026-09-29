package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record RecommendationFeedbackView(String id, String body, Instant createdAt) {}
