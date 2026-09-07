package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ContentLike;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ContentLikeMapper extends BaseMapper<ContentLike> {

    @Select("""
            SELECT * FROM content_like
            WHERE user_id = #{userId} AND object_type = #{objectType} AND object_id = #{objectId}
            """)
    ContentLike findByUserAndObject(String userId, String objectType, String objectId);

    @Delete("""
            DELETE FROM content_like
            WHERE user_id = #{userId} AND object_type = #{objectType} AND object_id = #{objectId}
            """)
    int deleteByUserAndObject(String userId, String objectType, String objectId);

    @Select("""
            SELECT COUNT(*) FROM content_like
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    long countByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM content_like
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<ContentLike> listByUserId(String userId, int limit);

    @Select("SELECT COUNT(*) FROM content_like WHERE user_id = #{userId}")
    long countByUserId(String userId);
}
