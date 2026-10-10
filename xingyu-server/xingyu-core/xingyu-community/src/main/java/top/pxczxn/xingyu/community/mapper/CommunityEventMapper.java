package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

@Mapper
public interface CommunityEventMapper extends BaseMapper<CommunityEvent> {

    @Select("""
            SELECT * FROM community_event
            WHERE status = 'ACTIVE'
            ORDER BY starts_at DESC, created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityEvent> listActive(int limit);

    @Select("""
            SELECT * FROM community_event
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityEvent> listAll(int limit);

    @Select("SELECT * FROM community_event WHERE slug = #{slug} LIMIT 1")
    CommunityEvent findBySlug(String slug);

    /**
     * 显式写 ends_at，允许写 NULL。
     *
     * <p>不能用 {@code updateById} 达到这个目的：MyBatis-Plus 默认
     * {@code FieldStrategy.NOT_NULL}，实体上的 null 字段会被整段跳过，
     * 于是"清空自动结束时间"这个操作会静默无效。这里用定点 UPDATE 明确表达意图。</p>
     */
    @Update("UPDATE community_event SET ends_at = #{endsAt}, updated_at = #{updatedAt} WHERE id = #{id}")
    int updateEndsAt(@Param("id") String id,
                     @Param("endsAt") Instant endsAt,
                     @Param("updatedAt") Instant updatedAt);
}
