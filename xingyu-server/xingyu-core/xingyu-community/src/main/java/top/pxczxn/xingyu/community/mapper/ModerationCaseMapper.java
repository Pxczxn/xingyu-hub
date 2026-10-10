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

    /**
     * 取案件行并<b>加行锁</b>（{@code FOR UPDATE}）。
     *
     * <p>存在的理由：{@code decideCase} 是「读状态 → 判断是否 OPEN → 写 decision + measure + 关案件」
     * 的读改写序列。两个管理员同时裁决同一案件时，若不串行化，两边都会读到 OPEN，
     * 于是各写一条 decision、各执行一次 measure（重复隐藏），并出现"数据库显示已关闭、
     * 对象却被隐藏了两次"的撕裂。锁住案件行到提交为止，把这段串行化。
     *
     * <p>复用 {@code ConversationMapper.lockForUpdate} 的既有模式，不新造 lockVersion。
     */
    @Select("SELECT * FROM moderation_case WHERE id = #{caseId} FOR UPDATE")
    ModerationCase lockById(String caseId);
}
