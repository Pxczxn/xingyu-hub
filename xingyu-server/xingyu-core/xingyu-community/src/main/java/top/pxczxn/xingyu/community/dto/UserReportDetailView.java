package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class UserReportDetailView {
    String id;
    String status;
    String targetType;
    String targetId;
    /** 服务端现查的标题（文章标题；动态/评论为 null）。UI 用它描述"举报了什么"。 */
    String targetTitle;
    /** 服务端现查的摘要（文章摘要 / 动态正文 / 评论正文，已裁剪）。 */
    String targetSummary;
    String reason;
    String detail;
    Instant createdAt;
    Instant updatedAt;
    String caseId;
    String caseStatus;
    String measureId;
    /**
     * 该举报的历次补充说明，按真实 createdAt 升序。
     *
     * <p>补充说明是可写入口（POST /me/reports/{id}/supplements），因此读链必须闭合：
     * 举报人重新打开详情页时必须能读回自己写过的补充，而不是只存在于当次会话内存里。
     * 权限由 getMyReport 的服务端 owner 校验统一保证，DTO 不再重复做校验。
     */
    List<ReportSupplementView> supplements;
}
