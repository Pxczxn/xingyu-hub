package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

@Mapper
public interface WorkingDraftMapper extends BaseMapper<WorkingDraft> {

    @Select("SELECT * FROM working_draft WHERE article_id = #{articleId} LIMIT 1")
    WorkingDraft findByArticleId(String articleId);

    @Select("""
            SELECT wd.* FROM working_draft wd
            INNER JOIN article a ON a.id = wd.article_id
            WHERE wd.scheduled_publish_at IS NOT NULL
              AND wd.scheduled_publish_at <= #{now}
              AND a.lifecycle_status IN ('DRAFT', 'ACTIVE')
            LIMIT #{limit}
            """)
    List<WorkingDraft> listDueScheduledPublish(Instant now, int limit);
}
