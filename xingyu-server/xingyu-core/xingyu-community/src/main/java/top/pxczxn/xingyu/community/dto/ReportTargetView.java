package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 举报目标预览（服务端权威）。
 *
 * <p>举报必须从"内容上下文"发起——用户在文章/动态/评论页上点了举报，前端只把
 * objectType + objectId 带过来，由服务端现查并返回可展示信息。前端<b>不得</b>
 * 自行拼标题/作者：那些字段必须来自这里，否则任何人都能伪造"正在举报什么"。
 *
 * <p>本 DTO 只承载"用户能否举报它、以及它看起来是什么"这两件事：
 * <ul>
 *   <li>{@code objectType}/{@code objectId} —— 回显服务端归一化后的目标；</li>
 *   <li>{@code title}/{@code summary} —— 可读标题与摘要，缺失时为 null；</li>
 *   <li>{@code authorId}/{@code authorUsername}/{@code authorDisplayName} —— 作者身份，
 *       供页面展示与自我举报前置判断；</li>
 *   <li>{@code alreadyReported} —— 当前用户是否已有一条未终结举报，
 *       前端据此提示"你已举报过"而不是伪装成新提交。</li>
 * </ul>
 *
 * <p>不暴露对象的内部字段（正文全文、状态枚举、空间归属等）——举报人只需要确认
 * "我举报的是这一条"。
 */
@Value
@Builder
public class ReportTargetView {
    String objectType;
    String objectId;
    String title;
    String summary;
    String authorId;
    String authorUsername;
    String authorDisplayName;
    boolean alreadyReported;
}
