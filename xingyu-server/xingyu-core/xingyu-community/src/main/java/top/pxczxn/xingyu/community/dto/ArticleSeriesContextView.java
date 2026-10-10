package top.pxczxn.xingyu.community.dto;

import lombok.Data;

/** Minimal public context for an ACTIVE series containing an article. */
@Data
public class ArticleSeriesContextView {
    private String id;
    private String slug;
    private String title;
    private int position;
}
