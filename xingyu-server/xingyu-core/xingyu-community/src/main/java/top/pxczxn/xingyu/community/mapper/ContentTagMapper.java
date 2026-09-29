package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.ContentTag;

import java.util.List;

@Mapper
public interface ContentTagMapper extends BaseMapper<ContentTag> {

    @Select("""
            <script>
            SELECT DISTINCT sd.object_id FROM search_document sd
            WHERE sd.object_type = 'ARTICLE' AND sd.removed_at IS NULL
              AND (
                sd.object_id IN (
                  SELECT at.article_id FROM article_tag at
                  INNER JOIN domain_tag_relation dtr ON dtr.tag_id = at.tag_id
                  WHERE dtr.domain_id IN
                  <foreach collection='domainIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
                )
                OR EXISTS (
                  SELECT 1 FROM domain_tag_relation dtr
                  INNER JOIN content_tag ct ON ct.id = dtr.tag_id
                  WHERE dtr.domain_id IN
                  <foreach collection='domainIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
                    AND (
                      LOWER(sd.title) LIKE CONCAT('%', ct.normalized_name, '%')
                      OR LOWER(sd.summary) LIKE CONCAT('%', ct.normalized_name, '%')
                      OR LOWER(sd.title) LIKE CONCAT('%', ct.name, '%')
                      OR LOWER(sd.summary) LIKE CONCAT('%', ct.name, '%')
                    )
                )
              )
            ORDER BY sd.indexed_at DESC
            LIMIT #{limit}
            </script>
            """)
    List<String> listArticleIdsByDomains(@Param("domainIds") List<String> domainIds, @Param("limit") int limit);

    @Select("""
            <script>
            SELECT DISTINCT ct.name FROM content_tag ct
            INNER JOIN domain_tag_relation dtr ON dtr.tag_id = ct.id
            WHERE dtr.domain_id IN
            <foreach collection='domainIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            </script>
            """)
    List<String> listTagNamesByDomains(@Param("domainIds") List<String> domainIds);
}
