package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.CollaborationInvite;

@Mapper
public interface CollaborationInviteMapper extends BaseMapper<CollaborationInvite> {

    @Select("SELECT * FROM collaboration_invite WHERE token = #{token} LIMIT 1")
    CollaborationInvite findByToken(String token);
}
