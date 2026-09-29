package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("series_chapter")
public class SeriesChapter {
    @TableId
    private String id;
    private String seriesId;
    private String articleId;
    private Integer position;
    private Instant createdAt;
}
