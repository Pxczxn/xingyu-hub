package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.FeaturedContent;

import java.util.List;

@Mapper
public interface FeaturedContentMapper extends BaseMapper<FeaturedContent> {

    @Select("""
            SELECT * FROM featured_content
            WHERE status = 'ACTIVE'
            ORDER BY sort_order ASC, created_at DESC
            LIMIT #{limit}
            """)
    List<FeaturedContent> listActive(int limit);

    @Select("""
            SELECT * FROM featured_content
            ORDER BY status ASC, sort_order ASC, created_at DESC
            LIMIT #{limit}
            """)
    List<FeaturedContent> listAll(int limit);
}
