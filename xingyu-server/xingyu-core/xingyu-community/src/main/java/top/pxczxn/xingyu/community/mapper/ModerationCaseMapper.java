package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ModerationCaseMapper extends BaseMapper<ModerationCase> {

    @Select("""
            SELECT * FROM moderation_case
            WHERE status = 'OPEN'
            ORDER BY created_at ASC
            """)
    List<ModerationCase> listOpen();

    @Select("""
            SELECT * FROM moderation_case
            WHERE report_id = #{reportId}
            LIMIT 1
            """)
    ModerationCase findByReportId(String reportId);
}
