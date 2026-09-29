package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TopicCreatorView {
    String username;
    String displayName;
    long contentCount;
}
