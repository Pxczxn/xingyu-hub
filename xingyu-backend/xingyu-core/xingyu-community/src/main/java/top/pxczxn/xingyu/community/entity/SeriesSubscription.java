package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("series_subscription")
public class SeriesSubscription {
    @TableId
    private String id;
    private String userId;
    private String seriesId;
    private Instant createdAt;
}
