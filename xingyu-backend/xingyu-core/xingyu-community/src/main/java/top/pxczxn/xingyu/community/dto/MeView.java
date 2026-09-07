package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MeView {
    String email;
    boolean emailVerified;
}
