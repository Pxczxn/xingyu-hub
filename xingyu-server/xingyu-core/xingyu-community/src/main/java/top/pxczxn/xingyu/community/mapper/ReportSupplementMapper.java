package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.ReportSupplement;

import java.util.List;

@Mapper
public interface ReportSupplementMapper extends BaseMapper<ReportSupplement> {

    @Select("""
            SELECT * FROM report_supplement
            WHERE report_id = #{reportId}
            ORDER BY created_at ASC
            """)
    List<ReportSupplement> listByReportId(String reportId);
}
