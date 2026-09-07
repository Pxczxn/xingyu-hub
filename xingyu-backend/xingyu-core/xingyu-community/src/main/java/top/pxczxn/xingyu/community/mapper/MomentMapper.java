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

    @Select("""
            SELECT * FROM moment
            WHERE author_id = #{authorId} AND status = 'PUBLISHED'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Moment> listByAuthorId(String authorId, int limit);
}
