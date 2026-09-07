package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class ApiTokenView {
    String id;
    String name;
    String tokenPrefix;
    List<String> scopes;
    String status;
    Instant lastUsedAt;
    Instant createdAt;
}
