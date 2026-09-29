package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CommunityCreationSpaceMapper extends BaseMapper<CommunityCreationSpace> {

    @Select("SELECT * FROM community_creation_space WHERE user_id = #{userId} LIMIT 1")
    CommunityCreationSpace findByUserId(String userId);

    @Select("SELECT * FROM community_creation_space WHERE slug = #{slug} LIMIT 1")
    CommunityCreationSpace findBySlug(String slug);
}
