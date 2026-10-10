package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ChatMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ChatMessageMapper extends BaseMapper<ChatMessage> {

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
            ORDER BY sequence_number ASC
            LIMIT #{limit}
            """)
    List<ChatMessage> listByConversationId(String conversationId, int limit);

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
              AND message_type = #{messageType}
            ORDER BY sequence_number DESC
            LIMIT #{limit}
            """)
    List<ChatMessage> listByConversationIdAndType(String conversationId, String messageType, int limit);

    @Select("SELECT * FROM chat_message WHERE id = #{messageId}")
    ChatMessage findById(String messageId);

    @Select("SELECT * FROM chat_message WHERE conversation_id = #{conversationId} AND sequence_number = #{sequence} LIMIT 1")
    ChatMessage findBySequence(String conversationId, long sequence);

    @Select("""
            SELECT m.* FROM chat_message m
            INNER JOIN conversation_member cm ON cm.conversation_id = m.conversation_id
            WHERE cm.user_id = #{userId}
              AND (m.body LIKE CONCAT('%', #{query}, '%')
                   OR m.attachment_name LIKE CONCAT('%', #{query}, '%'))
            ORDER BY m.created_at DESC
            LIMIT #{limit}
            """)
    List<ChatMessage> searchForUser(String userId, String query, int limit);

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
            ORDER BY sequence_number DESC
            LIMIT 1
            """)
    ChatMessage findLastByConversationId(String conversationId);

    /**
     * 未读条数 —— <b>排除自己发送的消息</b>。
     *
     * <p>2026-10-06：此前没有 {@code sender_id != #{userId}} 过滤，于是「我发出去的
     * 3 条」会算成我自己的 3 条未读，会话行徽标与 Header 角标都会虚高。修复放在服务端，
     * 因为前端减数字会让邮件箱列表与任何其它消费者（未来的推送、移动端）算出不同结果。
     */
    @Select("""
            SELECT COUNT(*) FROM chat_message m
            WHERE m.conversation_id = #{conversationId}
              AND m.sender_id <> #{userId}
              AND m.sequence_number > COALESCE(
                  (SELECT last_read_sequence FROM conversation_member
                   WHERE conversation_id = #{conversationId} AND user_id = #{userId}), 0)
            """)
    long countUnread(String conversationId, String userId);

    /**
     * 会话内序号大于 {@code afterSequence} 的消息，<b>升序</b>。
     *
     * <p>这是重连对账用的方向：{@link #listPageBeforeSequence} 只能往回翻历史，而断线期间
     * 漏掉的消息在「已知最大序号之后」。用序号而不是时间戳，因为 {@code sequence_number}
     * 是会话内单调计数，没有同秒并列的问题（通知那边是 created_at + 随机 UUID，只能给
     * 稳定顺序，给不了「之后」语义）。
     */
    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
              AND (#{afterSequence} IS NULL OR sequence_number > #{afterSequence})
            ORDER BY sequence_number ASC
            LIMIT #{limit}
            """)
    List<ChatMessage> listAfterSequence(String conversationId, Long afterSequence, int limit);

    @Select("""
            SELECT COALESCE(MAX(sequence_number), 0) FROM chat_message
            WHERE conversation_id = #{conversationId}
            """)
    long maxSequenceNumber(String conversationId);

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
              AND (#{beforeSequence} IS NULL OR sequence_number < #{beforeSequence})
            ORDER BY sequence_number DESC
            LIMIT #{limit}
            """)
    List<ChatMessage> listPageBeforeSequence(String conversationId, Long beforeSequence, int limit);

    /**
     * 目标序号<b>之前</b>的若干条（不含目标），升序。
     *
     * <p>与 {@link #listPageBeforeSequence} 的区别：那个是「最旧的 limit 条」（翻页用，
     * 离目标可能很远），这个是「紧邻目标之前的 limit 条」，配合
     * {@link #listAfterSequence} 就能把任意一条历史消息直接圈出来 —— 搜索结果点进去要落在
     * 那一条上，而不允许从最新一页一路往前翻。
     */
    @Select("""
            SELECT * FROM (
              SELECT * FROM chat_message
              WHERE conversation_id = #{conversationId}
                AND sequence_number <= #{beforeSequence}
              ORDER BY sequence_number DESC
              LIMIT #{limit}
            ) recent
            ORDER BY recent.sequence_number ASC
            """)
    List<ChatMessage> listUpToSequence(String conversationId, long beforeSequence, int limit);

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
              AND sender_id = #{senderId}
              AND client_message_id = #{clientMessageId}
            """)
    ChatMessage findByClientMessageId(String conversationId, String senderId, String clientMessageId);
}
