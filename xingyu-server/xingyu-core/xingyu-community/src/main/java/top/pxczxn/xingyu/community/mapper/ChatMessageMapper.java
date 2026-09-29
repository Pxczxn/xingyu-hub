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

    @Select("""
            SELECT COUNT(*) FROM chat_message m
            WHERE m.conversation_id = #{conversationId}
              AND m.sequence_number > COALESCE(
                  (SELECT last_read_sequence FROM conversation_member
                   WHERE conversation_id = #{conversationId} AND user_id = #{userId}), 0)
            """)
    long countUnread(String conversationId, String userId);

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

    @Select("""
            SELECT * FROM chat_message
            WHERE conversation_id = #{conversationId}
              AND sender_id = #{senderId}
              AND client_message_id = #{clientMessageId}
            """)
    ChatMessage findByClientMessageId(String conversationId, String senderId, String clientMessageId);
}
