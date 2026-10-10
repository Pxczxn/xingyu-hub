package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("appeal")
public class Appeal {
    @TableId
    private String id;
    private String caseId;
    private String appellantId;
    private String body;
    /**
     * 状态：{@code PENDING}（待处理）/ {@code APPROVED} / {@code REJECTED}。
     *
     * <p>契约：**是否待处理**由 {@code PENDING} 唯一表达；终局只可能是 APPROVED 或 REJECTED。
     * 不再使用旧实现的 {@code SUBMITTED}/{@code DECIDED}（后者把批准与驳回混成同一个值，
     * 使得"这次申诉到底批准还是驳回"无法从数据回答）。
     */
    private String status;
    /** 终局结论：APPROVED / REJECTED；NULL = 尚未裁决。与 status 同值，冗余但显式。 */
    private String outcome;
    /** 处理人；NULL = 未处理。 */
    private String decidedBy;
    /** 处理时间（UTC）；NULL = 未处理。 */
    private Instant decidedAt;
    /** 处理说明。 */
    private String decisionNote;
    private Instant createdAt;
}
