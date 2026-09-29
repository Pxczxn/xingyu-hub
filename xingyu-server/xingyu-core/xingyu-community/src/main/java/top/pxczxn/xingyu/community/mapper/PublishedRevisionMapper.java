package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PublishedRevisionMapper extends BaseMapper<PublishedRevision> {

    @Select("SELECT * FROM published_revision WHERE article_id = #{articleId} LIMIT 1")
    PublishedRevision findByArticleId(String articleId);

    @Select("SELECT * FROM published_revision WHERE publication_event_id = #{eventId} LIMIT 1")
    PublishedRevision findByPublicationEventId(String eventId);

    @Select("""
            SELECT pr.* FROM published_revision pr
            INNER JOIN article a ON a.id = pr.article_id
            INNER JOIN formal_revision fr ON fr.id = pr.formal_revision_id
            WHERE a.space_id = #{spaceId}
              AND fr.visibility IN ('PUBLIC', 'UNLISTED')
            ORDER BY pr.published_at DESC, pr.article_id DESC
            LIMIT #{limit}
            """)
    List<PublishedRevision> listPublicBySpaceId(String spaceId, int limit);
}
