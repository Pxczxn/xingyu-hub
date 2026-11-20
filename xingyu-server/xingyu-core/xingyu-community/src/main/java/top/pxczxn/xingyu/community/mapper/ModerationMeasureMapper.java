package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.CaseMeasureRow;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ModerationMeasureMapper extends BaseMapper<ModerationMeasure> {

    @Select("""
            SELECT mm.* FROM moderation_measure mm
            INNER JOIN moderation_decision md ON md.id = mm.decision_id
            WHERE md.case_id = #{caseId}
            ORDER BY mm.created_at DESC
            LIMIT 1
            """)
    ModerationMeasure findLatestByCaseId(String caseId);

    /**
     * 同一目标上、不属于本次案件、且仍然有效的隐藏措施。
     *
     * <p>一条 {@code HIDE_CONTENT} 仍然有效，当且仅当它所属案件没有状态为
     * {@code APPROVED} 的申诉。没有申诉、待处理、已驳回都算有效。一个案件只有一条申诉。
     * 已批准的申诉只让这一案的措施失效，不带动其他案件。
     */
    @Select("""
            SELECT COUNT(*) FROM moderation_measure mm
            INNER JOIN moderation_decision md ON md.id = mm.decision_id
            WHERE mm.measure_type = 'HIDE_CONTENT'
              AND UPPER(mm.target_type) = UPPER(#{targetType})
              AND mm.target_id = #{targetId}
              AND mm.id <> #{measureId}
              AND (#{caseId,jdbcType=VARCHAR} IS NULL OR md.case_id <> #{caseId,jdbcType=VARCHAR})
              AND NOT EXISTS (
                  SELECT 1 FROM appeal ap
                  WHERE ap.case_id = md.case_id
                    AND ap.status = 'APPROVED'
              )
            """)
    Long countOtherActiveHides(@Param("targetType") String targetType,
                               @Param("targetId") String targetId,
                               @Param("caseId") String caseId,
                               @Param("measureId") String measureId);

    /**
     * 锁住同一目标上的隐藏措施行。调用方必须已经锁住动态行。
     * 这里不连接申诉表，避免和另一笔仍持有申诉行锁、正在等动态锁的事务交叉。
     */
    @Select("""
            SELECT id FROM moderation_measure
            WHERE measure_type = 'HIDE_CONTENT'
              AND UPPER(target_type) = UPPER(#{targetType})
              AND target_id = #{targetId}
            FOR UPDATE
            """)
    List<String> lockHideMeasures(@Param("targetType") String targetType,
                                  @Param("targetId") String targetId);

    @Select("""
            SELECT COUNT(*) FROM moderation_measure
            WHERE measure_type = 'HIDE_CONTENT'
              AND UPPER(target_type) = UPPER(#{targetType})
              AND target_id = #{targetId}
              AND (prior_status IS NULL OR TRIM(prior_status) = '')
            """)
    Long countUnrecordedHidePriors(@Param("targetType") String targetType,
                                   @Param("targetId") String targetId);

    @Select("""
            SELECT prior_status FROM moderation_measure
            WHERE measure_type = 'HIDE_CONTENT'
              AND UPPER(target_type) = UPPER(#{targetType})
              AND target_id = #{targetId}
              AND prior_status IS NOT NULL
              AND TRIM(prior_status) <> ''
            """)
    List<String> listRecordedHidePriors(@Param("targetType") String targetType,
                                        @Param("targetId") String targetId);

    @Select("""
            <script>
            SELECT case_id, measure_type FROM (
                SELECT md.case_id AS case_id, mm.measure_type AS measure_type,
                       ROW_NUMBER() OVER (
                           PARTITION BY md.case_id
                           ORDER BY mm.created_at DESC
                       ) AS rn
                FROM moderation_measure mm
                INNER JOIN moderation_decision md ON md.id = mm.decision_id
                WHERE md.case_id IN
                <foreach collection='caseIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            ) ranked
            WHERE rn = 1
            </script>
            """)
    List<CaseMeasureRow> listLatestByCaseIds(@Param("caseIds") List<String> caseIds);
}
