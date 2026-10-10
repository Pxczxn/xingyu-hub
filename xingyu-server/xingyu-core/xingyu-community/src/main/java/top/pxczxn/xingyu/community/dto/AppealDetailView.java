package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 用户侧看到的申诉详情。
 *
 * <p>契约（V046 起唯一词表）：
 * <ul>
 *   <li>{@code status} = PENDING / APPROVED / REJECTED —— {@code PENDING} 即"当前待处理"；</li>
 *   <li>{@code outcome} 与 {@code status} 同值，终局结论显式可读（旧实现只给 DECIDED，读不出结果）；</li>
 *   <li>{@code decidedAt} / {@code decisionNote} 在未处理时为 null，UI 必须渲染为"尚未处理"，
 *       不得伪造时间或说明。</li>
 * </ul>
 *
 * <p>「原处理对象 / 原决定」链：申诉是「针对某项治理措施」的异议，因此详情必须能说明
 * <b>针对什么处理</b>。这里通过 reporting 侧现查携带：
 * <ul>
 *   <li>{@code targetType} / {@code targetId}：原被处理对象（接口照实返回标识，UI 不渲染 UUID）；</li>
 *   <li>{@code targetTitle} / {@code targetSummary}：原对象的人类可读描述（服务端现查）；</li>
 *   <li>{@code measureType}：原治理措施类型（如 HIDE_CONTENT），即"原决定"。</li>
 * </ul>
 *
 * <p>刻意不暴露 {@code decidedBy}（管理员身份）给用户侧 —— 用户只需要知道结论与说明。
 */
@Value
@Builder
public class AppealDetailView {
    String id;
    String caseId;
    String body;
    String status;
    /** APPROVED / REJECTED；null = 尚未裁决。 */
    String outcome;
    /** 处理时间；null = 尚未处理。 */
    Instant decidedAt;
    /** 处理说明；null = 未填写或尚未处理。 */
    String decisionNote;
    /** 原被处理对象类型（ARTICLE / MOMENT / COMMENT）；无法解析时为 null。 */
    String targetType;
    /** 原被处理对象标识（UUID）。接口照实返回，UI 不渲染。 */
    String targetId;
    /** 原对象的人类可读标题（文章；其余为 null）。 */
    String targetTitle;
    /** 原对象的人类可读摘要（已裁剪）。 */
    String targetSummary;
    /** 原治理措施类型，即"原决定"；无措施时为 null。 */
    String measureType;
    Instant createdAt;
}
