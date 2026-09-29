package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SeoMetadataView {
    String objectType;
    String objectId;
    String title;
    String description;
    String canonicalUrl;
    String ogImageUrl;
}
