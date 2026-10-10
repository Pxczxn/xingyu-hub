package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Conversation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {

    /**
     * 取会话行并<b>加行锁</b>（{@code FOR UPDATE}）。
     *
     * <p>存在的唯一理由：{@code sendMessage} 用「读 max(sequence_number) → +1 → insert」分配
     * 序号。两个并发发送会读到同一个 max，于是都去插同一个序号，撞
     * {@code uk_chat_message_sequence}，直接 500 且那条消息丢失（2026-10-06 实测：12 条并发
     * 里有若干条变 500，日志是 duplicate key）。
     *
     * <p>锁会话行而不是消息行：序号是「会话内」的，必须按会话串行；而且发送本来就在一个事务
     * 里，锁住会话行到提交为止，天然覆盖了「读 max」到「insert」这一段。
     */
    @Select("SELECT * FROM conversation WHERE id = #{conversationId} FOR UPDATE")
    Conversation lockForUpdate(String conversationId);

    @Select("SELECT * FROM conversation WHERE type = 'GROUP' ORDER BY updated_at DESC LIMIT #{limit}")
    List<Conversation> listGroupsForAdmin(int limit);

    @Select("""
            SELECT c.* FROM conversation c
            JOIN conversation_member m ON m.conversation_id = c.id
            WHERE m.user_id = #{userId}
            ORDER BY c.updated_at DESC
            """)
    List<Conversation> listByUserId(String userId);
}
