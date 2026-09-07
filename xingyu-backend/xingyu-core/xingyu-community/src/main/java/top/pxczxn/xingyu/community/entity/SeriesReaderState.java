package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("series_reader_state")
public class SeriesReaderState {
    @TableId
    private String id;
    private String seriesId;
    private String userId;
    private String lastReadArticleId;
    private Instant lastReadAt;
    private Integer following;
    private Instant createdAt;
    private Instant updatedAt;
}
