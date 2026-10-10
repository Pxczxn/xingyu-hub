package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 一条消息的对外结构。
 *
 * <p>2026-10-06：新增结构化 {@code sender}。此前只有 {@code senderId}，群聊里只能显示
 * 「UUID 前 8 位…」，且发送者改名后无法定位。{@code senderId} 保留（兼容既有消费者），
 * {@code sender} 由读取时现查 profile 得到，因此改名后历史消息仍指向当前 canonical identity。
 */
@Value
@Builder
public class ChatMessageView {
    String id;
    String conversationId;
    String conversationType;
    String senderId;
    /**
     * 结构化发送者；profile 查不到时 {@code sender} 为 null（此时 senderId 仍在，
     * 前端退化为不显示名字，而不是崩溃）。
     */
    ChatMessageSenderView sender;
    long sequenceNumber;
    String body;
    String messageType;
    String attachmentUrl;
    String attachmentName;
    Long attachmentFileId;
    Instant createdAt;
    Instant recalledAt;
    /**
     * 撤回截止时刻（2026-10-06）。
     *
     * <p>服务端按<b>同一套</b>撤回窗口规则算出来（{@code createdAt + messageRecallWindowSeconds}），
     * 前端只拿它跟「现在」比，不需要复制那个常量。没有它时 UI 只能对自己的每条消息常驻一个
     * 撤回按钮，而窗口只有 120 秒 —— 过期后点击必然 409（实测）。
     *
     * <p>仍然只是提示：服务端始终是权威，撞到边界时照旧 409，由调用方正常处理。
     * 已撤回的消息这个字段为 null（本来也没有可撤回的东西了）。
     */
    Instant recallUntil;
    /**
     * DIRECT 会话里「对方」的展示名。
     *
     * <p><b>只在 {@code GET /messages/search} 的命中行上填充</b>：搜索是跨会话的，如果不带
     * 这个字段，结果行既不知道是谁说的，也不知道来自哪个会话（实测两项都缺）。
     * 其它端点为 null —— 会话本身已经带 counterpartDisplayName，不必重复。
     */
    String counterpartDisplayName;
}
