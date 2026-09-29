package top.pxczxn.xingyu.community.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonPOJOBuilder;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
@JsonDeserialize(builder = RegisterResponse.RegisterResponseBuilder.class)
public class RegisterResponse {
    String userId;
    EmailVerificationStatus emailVerification;
    Boolean mailPending;
    String auditStatus;

    @JsonPOJOBuilder(withPrefix = "")
    public static class RegisterResponseBuilder {
    }

    @Value
    @Builder
    @JsonDeserialize(builder = EmailVerificationStatus.EmailVerificationStatusBuilder.class)
    public static class EmailVerificationStatus {
        String status;
        boolean canResend;

        @JsonPOJOBuilder(withPrefix = "")
        public static class EmailVerificationStatusBuilder {
        }
    }
}
