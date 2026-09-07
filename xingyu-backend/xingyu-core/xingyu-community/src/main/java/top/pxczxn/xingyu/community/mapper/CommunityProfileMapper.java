package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CommunityProfileMapper extends BaseMapper<CommunityProfile> {

    @Select("SELECT * FROM community_profile WHERE username = #{username} LIMIT 1")
    CommunityProfile findByUsername(String username);

    @Select("SELECT * FROM community_profile WHERE user_id = #{userId} LIMIT 1")
    CommunityProfile findByUserId(String userId);

    @Select("""
            SELECT * FROM community_profile
            WHERE user_id != #{excludeUserId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    java.util.List<CommunityProfile> listSuggested(String excludeUserId, int limit);
}
