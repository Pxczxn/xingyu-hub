package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

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
            SELECT * FROM formal_revision
            WHERE article_id = #{articleId}
            ORDER BY revision_number DESC
            """)
    java.util.List<FormalRevision> listByArticleId(String articleId);
}
