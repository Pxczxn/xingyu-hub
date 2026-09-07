package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ApiTokenCreatedView {
    String id;
    String name;
    String token;
    List<String> scopes;
}
