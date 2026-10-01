package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Moment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MomentMapper extends BaseMapper<Moment> {

    @Select("""
            SELECT * FROM moment
            WHERE status = 'PUBLISHED'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Moment> listPublished(int limit);

    /** Every moment that belongs in the public index (bulk form, for a rebuild). */
    @Select("SELECT id FROM moment WHERE status = 'PUBLISHED'")
    List<String> listIndexableIds();

    @Select("""
            SELECT * FROM moment
            WHERE author_id = #{authorId} AND status = 'PUBLISHED'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Moment> listByAuthorId(String authorId, int limit);
}
