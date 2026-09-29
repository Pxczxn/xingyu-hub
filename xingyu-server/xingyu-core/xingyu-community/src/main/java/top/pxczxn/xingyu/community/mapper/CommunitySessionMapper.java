package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommunitySessionMapper extends BaseMapper<CommunitySession> {

    @Select("SELECT * FROM community_session WHERE token_value = #{tokenValue} LIMIT 1")
    CommunitySession findByTokenValue(String tokenValue);

    @Select("""
            SELECT * FROM community_session
            WHERE user_id = #{userId}
            ORDER BY last_active_at DESC
            """)
    List<CommunitySession> listByUserId(String userId);
}
