package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

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
}
