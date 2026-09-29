package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.RecentAuthentication;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface RecentAuthenticationMapper extends BaseMapper<RecentAuthentication> {

    @Select("""
            SELECT * FROM recent_authentication
            WHERE id = #{id} AND user_id = #{userId} AND session_id = #{sessionId}
            LIMIT 1
            """)
    RecentAuthentication findByIdAndUserAndSession(String id, String userId, String sessionId);
}
