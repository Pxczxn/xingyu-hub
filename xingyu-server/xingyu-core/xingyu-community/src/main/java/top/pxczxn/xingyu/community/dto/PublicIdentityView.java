package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/** Minimal public identity for content ownership surfaces. */
@Value
@Builder
public class PublicIdentityView {
    String username;
    String displayName;
    String avatar;
}
