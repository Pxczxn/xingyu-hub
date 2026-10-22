package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.GalaxyContentSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GalaxyContentSubmissionMapper extends BaseMapper<GalaxyContentSubmission> {

    /** 同一推荐人在同一星系对同一作品的待审申请（用于幂等：重复提交返回既有申请）。 */
    @Select("""
            SELECT * FROM galaxy_content_submission
            WHERE galaxy_id = #{galaxyId}
              AND submitter_id = #{submitterId}
              AND object_type = #{objectType}
              AND object_id = #{objectId}
              AND status = 'PENDING'
            ORDER BY created_at DESC
            LIMIT 1
            """)
    GalaxyContentSubmission findPending(String galaxyId, String submitterId, String objectType, String objectId);

    /** 该作品在该星系是否已有通过记录（不论谁推荐），避免同一作品重复上架。 */
    @Select("""
            SELECT * FROM galaxy_content_submission
            WHERE galaxy_id = #{galaxyId}
              AND object_type = #{objectType}
              AND object_id = #{objectId}
              AND status = 'APPROVED'
            LIMIT 1
            """)
    GalaxyContentSubmission findApproved(String galaxyId, String objectType, String objectId);

    /** 成员视角：自己在该星系的推荐记录（新到旧）。 */
    @Select("""
            SELECT * FROM galaxy_content_submission
            WHERE galaxy_id = #{galaxyId} AND submitter_id = #{submitterId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<GalaxyContentSubmission> listBySubmitter(String galaxyId, String submitterId, int limit);

    /** 管理端视角：某星系某状态的推荐（新到旧）。 */
    @Select("""
            SELECT * FROM galaxy_content_submission
            WHERE galaxy_id = #{galaxyId} AND status = #{status}
            ORDER BY created_at ASC
            LIMIT #{limit}
            """)
    List<GalaxyContentSubmission> listByGalaxyAndStatus(String galaxyId, String status, int limit);
}
