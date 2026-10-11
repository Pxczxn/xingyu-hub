package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class PublicSeriesView {
    String id;
    String title;
    String slug;
    String description;
    List<SeriesChapterView> chapters;
    PublicIdentityView author;
    /**
     * 当前登录用户是否已订阅该系列（viewer-scoped）。游客为 null——
     * 「未知」与「未订阅」必须区分（2026-10-10 Series Subscription Closure）。
     */
    Boolean hasSubscribed;
}
