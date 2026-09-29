package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ReviewSubmissionMapper extends BaseMapper<ReviewSubmission> {

    @Select("""
            SELECT * FROM review_submission
            WHERE status = 'PENDING'
            ORDER BY submitted_at ASC
            """)
    List<ReviewSubmission> listPending();

    @Select("""
            SELECT * FROM review_submission
            WHERE article_id = #{articleId} AND status = 'PENDING'
            LIMIT 1
            """)
    ReviewSubmission findPendingByArticleId(String articleId);

    @Select("""
            SELECT * FROM review_submission
            WHERE submitted_by = #{userId}
            ORDER BY submitted_at DESC
            LIMIT #{limit}
            """)
    List<ReviewSubmission> listBySubmittedBy(String userId, int limit);
}
