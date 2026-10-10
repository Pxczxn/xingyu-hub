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

    /**
     * 同一用户对同一对象是否已有**未终结**举报（SUBMITTED/TRIAGED）。
     *
     * <p>用于"重复举报最小诚实规则"：已有 active report 时不再建第二条，直接复用。
     * 这只是快速路径；真正的并发正确性由 {@code uk_report_active} 唯一索引保证
     * （见 V047）——「先 SELECT 再 INSERT」在并发下必然有窗口，不能单独作为正确性依据。
     */
    @Select("""
            SELECT * FROM report
            WHERE reporter_id = #{reporterId}
              AND object_type = #{objectType}
              AND object_id = #{objectId}
              AND status IN ('SUBMITTED', 'TRIAGED')
            LIMIT 1
            """)
    Report findActiveByReporterAndObject(String reporterId, String objectType, String objectId);
}
