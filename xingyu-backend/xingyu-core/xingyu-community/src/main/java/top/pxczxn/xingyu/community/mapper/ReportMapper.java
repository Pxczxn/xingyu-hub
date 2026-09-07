package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Report;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ReportMapper extends BaseMapper<Report> {
    @Select("SELECT * FROM report WHERE (#{status} IS NULL OR status = #{status}) ORDER BY created_at DESC LIMIT #{limit}")
    List<Report> listForAdmin(String status, int limit);

    @Select("""
            SELECT * FROM report
            WHERE reporter_id = #{reporterId}
            ORDER BY created_at DESC
            """)
    List<Report> listByReporterId(String reporterId);
}
