package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Appeal;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AppealMapper extends BaseMapper<Appeal> {
    @Select("SELECT * FROM appeal WHERE (#{status} IS NULL OR status = #{status}) ORDER BY created_at DESC LIMIT #{limit}")
    List<Appeal> listForAdmin(String status, int limit);

    @Select("""
            SELECT * FROM appeal
            WHERE appellant_id = #{appellantId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Appeal> listByAppellantId(String appellantId, int limit);

    /** 该案件是否已有申诉（案件内至多一条 —— 服务端一次性保证）。 */
    @Select("SELECT * FROM appeal WHERE case_id = #{caseId} LIMIT 1")
    Appeal findByCaseId(String caseId);

    /**
     * 取申诉行并<b>加行锁</b>（{@code FOR UPDATE}）。
     *
     * <p>理由同 {@code ModerationCaseMapper.lockById}：{@code decideAppealQueue} 是
     * 「读状态 → 判断是否 PENDING → 写 outcome + 可能 revoke measure」的读改写序列。
     * 两个管理员同时处理同一条申诉时，若不串行化，两边都会读到 PENDING，于是批准与驳回
     * 同时生效 —— 可能出现「数据库写 REJECTED、对象却已 restore」的撕裂。
     */
    @Select("SELECT * FROM appeal WHERE id = #{id} FOR UPDATE")
    Appeal lockById(String id);
}
