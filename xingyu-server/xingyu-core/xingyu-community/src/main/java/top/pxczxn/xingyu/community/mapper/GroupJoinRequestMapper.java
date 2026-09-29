package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.GroupJoinRequest;

import java.util.List;

@Mapper
public interface GroupJoinRequestMapper extends BaseMapper<GroupJoinRequest> {

    @Select("""
            SELECT * FROM group_join_request
            WHERE conversation_id = #{conversationId} AND user_id = #{userId} AND status = 'PENDING'
            LIMIT 1
            """)
    GroupJoinRequest findPending(String conversationId, String userId);

    @Select("""
            SELECT * FROM group_join_request
            WHERE conversation_id = #{conversationId} AND status = 'PENDING'
            ORDER BY created_at ASC
            """)
    List<GroupJoinRequest> listPending(String conversationId);

    @Select("""
            SELECT * FROM group_join_request
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<GroupJoinRequest> listByUserId(String userId, int limit);
}
