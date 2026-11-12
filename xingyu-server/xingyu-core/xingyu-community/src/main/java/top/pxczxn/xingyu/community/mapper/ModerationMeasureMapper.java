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
