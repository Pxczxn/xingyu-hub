package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ConversationMemberMapper extends BaseMapper<ConversationMember> {

    @Select("""
            SELECT * FROM conversation_member
            WHERE conversation_id = #{conversationId} AND user_id = #{userId}
            """)
    ConversationMember findByConversationAndUser(String conversationId, String userId);

    @Select("""
            SELECT * FROM conversation_member
            WHERE conversation_id = #{conversationId}
            """)
    List<ConversationMember> listByConversationId(String conversationId);

    @Select("""
            SELECT m1.conversation_id FROM conversation_member m1
            JOIN conversation_member m2 ON m1.conversation_id = m2.conversation_id
            JOIN conversation c ON c.id = m1.conversation_id
            WHERE c.type = 'DIRECT'
              AND m1.user_id = #{userId1} AND m2.user_id = #{userId2}
            LIMIT 1
            """)
    String findDirectConversationId(String userId1, String userId2);
}
