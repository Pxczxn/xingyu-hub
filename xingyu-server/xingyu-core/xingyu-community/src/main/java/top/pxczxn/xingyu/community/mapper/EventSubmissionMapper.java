package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.EventSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface EventSubmissionMapper extends BaseMapper<EventSubmission> {

    @Select("""
            SELECT * FROM event_submission
            WHERE author_id = #{authorId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<EventSubmission> listByAuthorId(String authorId, int limit);

    @Select("""
            SELECT * FROM event_submission
            WHERE event_id = #{eventId} AND author_id = #{authorId}
              AND object_type = #{objectType} AND object_id = #{objectId}
            LIMIT 1
            """)
    EventSubmission findByEventAndObject(String eventId, String authorId, String objectType, String objectId);

    /** 审核前锁定投稿行，避免两笔审核同时读到 SUBMITTED。 */
    @Select("SELECT * FROM event_submission WHERE id = #{id} FOR UPDATE")
    EventSubmission findByIdForUpdate(String id);

    @Select("""
            SELECT * FROM event_submission
            WHERE event_id = #{eventId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<EventSubmission> listByEventId(String eventId, int limit);

    @Select("""
            SELECT * FROM event_submission
            WHERE event_id = #{eventId} AND status = 'ACCEPTED'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<EventSubmission> listAcceptedByEventId(String eventId, int limit);
}
