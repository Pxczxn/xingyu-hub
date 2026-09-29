package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SeoMetadata;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SeoMetadataMapper extends BaseMapper<SeoMetadata> {

    @Select("""
            SELECT * FROM seo_metadata
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    SeoMetadata findByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM seo_metadata
            WHERE object_type = 'ARTICLE'
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<SeoMetadata> listArticles(int limit);
}
