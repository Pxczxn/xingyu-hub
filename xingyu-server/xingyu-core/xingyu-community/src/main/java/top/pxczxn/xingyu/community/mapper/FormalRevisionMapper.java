package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FormalRevisionMapper extends BaseMapper<FormalRevision> {

    @Select("""
            SELECT COALESCE(MAX(revision_number), 0) FROM formal_revision
            WHERE article_id = #{articleId}
            """)
    int maxRevisionNumber(String articleId);

    @Select("SELECT * FROM formal_revision WHERE id = #{id} LIMIT 1")
    FormalRevision findById(String id);

    @Select("""
            <script>
            SELECT * FROM formal_revision
            WHERE id IN
            <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            </script>
            """)
    List<FormalRevision> listByIds(@Param("ids") List<String> ids);

    @Select("""
            <script>
            SELECT r.* FROM formal_revision r
            INNER JOIN (
                SELECT article_id, MAX(revision_number) AS revision_number
                FROM formal_revision
                WHERE article_id IN
                <foreach collection='articleIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
                GROUP BY article_id
            ) latest ON latest.article_id = r.article_id
                    AND latest.revision_number = r.revision_number
            </script>
            """)
    List<FormalRevision> listLatestByArticleIds(@Param("articleIds") List<String> articleIds);

    @Select("""
            SELECT * FROM formal_revision
            WHERE article_id = #{articleId}
            ORDER BY revision_number DESC
            """)
    java.util.List<FormalRevision> listByArticleId(String articleId);
}
