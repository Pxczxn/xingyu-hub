package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

@Mapper
public interface WorkingDraftMapper extends BaseMapper<WorkingDraft> {

    @Select("SELECT * FROM working_draft WHERE article_id = #{articleId} LIMIT 1")
    WorkingDraft findByArticleId(String articleId);

    /**
     * 扫描到期定时送审（2026-10-09 修正：原条件 {@code lifecycle_status IN ('DRAFT','ACTIVE')}
     * 里的 'DRAFT' 不是 lifecycle 合法值（合法值只有 ACTIVE/TRASHED），恒假子句属语义错误；
     * 等价改为 = 'ACTIVE'，行为不变、语义归正）。
     */
    @Select("""
            SELECT wd.* FROM working_draft wd
            INNER JOIN article a ON a.id = wd.article_id
            WHERE wd.scheduled_publish_at IS NOT NULL
              AND wd.scheduled_publish_at <= #{now}
              AND a.lifecycle_status = 'ACTIVE'
            LIMIT #{limit}
            """)
    List<WorkingDraft> listDueScheduledPublish(Instant now, int limit);

    /**
     * 原子认领一条到期定时计划（Studio Scheduling & Concurrency Recovery，2026-10-09）。
     *
     * <p>条件 UPDATE（当前读 + 行锁）：把到期计划的 scheduled_publish_at 置 NULL。
     * 返回 1 = 本 worker 认领成功；返回 0 = 计划已被并发 worker 消费 / 已取消 / 未到期。
     * 这是「同一次计划绝不被重复消费」的数据库级保证——此前实现是送审成功后
     * {@code setScheduledPublishAt(null) + updateById}，被 MyBatis-Plus 默认 NOT_NULL
     * 字段策略吞掉，计划永久残留（实测导致批准发布后每 60s 重复送审、公开文章反复下线）。
     * 必须与送审同事务执行（见 ReviewService#submitScheduledDraft）：送审失败回滚，计划恢复等待重试。
     */
    @Update("""
            UPDATE working_draft
            SET scheduled_publish_at = NULL
            WHERE article_id = #{articleId}
              AND scheduled_publish_at IS NOT NULL
              AND scheduled_publish_at <= #{now}
            """)
    int claimDueSchedule(@Param("articleId") String articleId, @Param("now") Instant now);
}
