package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

/**
 * 星系内容推荐（Galaxy Content Contribution，V054）。
 *
 * <p>状态机：PENDING → APPROVED / REJECTED。只有 APPROVED 才会在审核通过的
 * 同一事务里写入 {@code galaxy_content}；galaxy_content 仍是"已上架内容"的
 * 单一事实来源，本表只记录推荐与审核过程。
 */
@Data
@TableName("galaxy_content_submission")
public class GalaxyContentSubmission {
    @TableId
    private String id;
    private String galaxyId;
    private String submitterId;
    private String objectType;
    private String objectId;
    private String note;
    /** PENDING / APPROVED / REJECTED */
    private String status;
    private String rejectReason;
    private String resolvedBy;
    private Instant createdAt;
    private Instant resolvedAt;
}
