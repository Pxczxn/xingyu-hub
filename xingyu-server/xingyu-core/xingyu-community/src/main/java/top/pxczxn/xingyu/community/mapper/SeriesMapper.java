package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Series;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SeriesMapper extends BaseMapper<Series> {

    @Select("""
            SELECT * FROM series
            WHERE owner_id = #{ownerId}
            ORDER BY updated_at DESC
            """)
    List<Series> listByOwnerId(String ownerId);

    @Select("""
            SELECT * FROM series
            WHERE status = 'ACTIVE'
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<Series> listActive(int limit);

    @Select("""
            SELECT * FROM series
            WHERE owner_id = #{ownerId} AND slug = #{slug}
            """)
    Series findByOwnerIdAndSlug(String ownerId, String slug);

    @Select("""
            SELECT s.* FROM series s
            JOIN community_profile p ON p.user_id = s.owner_id
            WHERE p.username = #{username} AND s.slug = #{slug} AND s.status = 'ACTIVE'
            """)
    Series findPublicByUsernameAndSlug(String username, String slug);
}
