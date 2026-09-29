package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommunityEventMapper extends BaseMapper<CommunityEvent> {

    @Select("""
            SELECT * FROM community_event
            WHERE status = 'ACTIVE'
            ORDER BY starts_at DESC, created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityEvent> listActive(int limit);

    @Select("""
            SELECT * FROM community_event
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityEvent> listAll(int limit);

    @Select("SELECT * FROM community_event WHERE slug = #{slug} LIMIT 1")
    CommunityEvent findBySlug(String slug);
}
