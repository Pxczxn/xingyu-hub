package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 用户侧「我的举报」列表行。
 *
 * <p>列表必须能一眼回答四件事：<b>举报了什么 / 当前状态 / 举报原因 / 时间</b>。
 * 因此这里携带服务端现查的展示信息（{@code targetTitle} / {@code targetSummary}），
 * 前端不得自行拼装，也不得把 {@code targetId}（UUID）当作用户可读的标题渲染。
 *
 * <p>{@code targetId} 仍保留在响应里（接口本身照实返回对象标识），但用户界面**不展示**它：
 * 用户不认识 UUID，把它当作"举报了什么"等于把系统内部标识冒充成内容描述。
 */
@Value
@Builder
public class UserReportView {
    String id;
    String status;
    /** 被举报对象的类型，如 ARTICLE / MOMENT / COMMENT。 */
    String targetType;
    /** 被举报对象标识（UUID）。接口照实返回，UI 不渲染。 */
    String targetId;
    /** 服务端现查的标题（文章标题；动态/评论为 null）。 */
    String targetTitle;
    /** 服务端现查的摘要（文章摘要 / 动态正文 / 评论正文，已裁剪）。 */
    String targetSummary;
    /** 举报原因（用户提交时选择）。 */
    String reason;
    /** 案件 updatedAt（有案件时），否则举报自身 createdAt。 */
    Instant updatedAt;
}
