package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Article;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ArticleMapper extends BaseMapper<Article> {

    @Select("""
            SELECT * FROM article
            WHERE owner_id = #{ownerId}
            ORDER BY updated_at DESC
            """)
    List<Article> listByOwnerId(String ownerId);

    @Select("""
            SELECT * FROM article
            WHERE space_id = #{spaceId}
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<Article> listBySpaceId(String spaceId, int limit);
}
