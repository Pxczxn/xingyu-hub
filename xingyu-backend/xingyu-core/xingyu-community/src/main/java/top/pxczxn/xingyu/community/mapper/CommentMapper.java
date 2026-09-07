package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Comment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommentMapper extends BaseMapper<Comment> {

    @Select("""
            SELECT * FROM comment
            WHERE object_type = #{objectType} AND object_id = #{objectId} AND status = 'VISIBLE'
            ORDER BY created_at ASC
            """)
    List<Comment> listVisibleByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM comment
            WHERE author_id = #{authorId} AND status = 'VISIBLE'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Comment> listByAuthorId(String authorId, int limit);

    @Select("SELECT COUNT(*) FROM comment WHERE author_id = #{authorId} AND status = 'VISIBLE'")
    long countByAuthorId(String authorId);
}
