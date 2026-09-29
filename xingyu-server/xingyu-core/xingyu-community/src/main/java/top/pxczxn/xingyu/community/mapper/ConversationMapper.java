package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Conversation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
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
