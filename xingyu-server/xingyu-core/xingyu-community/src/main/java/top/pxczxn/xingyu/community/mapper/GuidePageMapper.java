package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.GuidePage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GuidePageMapper extends BaseMapper<GuidePage> {

    @Select("""
            SELECT * FROM guide_page
            WHERE status = 'PUBLISHED'
            ORDER BY sort_order ASC, published_at DESC
            LIMIT #{limit}
            """)
    List<GuidePage> listPublished(int limit);

    @Select("SELECT * FROM guide_page WHERE slug = #{slug} AND status = 'PUBLISHED' LIMIT 1")
    GuidePage findPublishedBySlug(String slug);

    @Select("SELECT * FROM guide_page ORDER BY sort_order ASC, created_at DESC")
    List<GuidePage> listAll();
}
