package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SeriesReaderState;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

@Mapper
public interface SeriesReaderStateMapper extends BaseMapper<SeriesReaderState> {

    @Select("""
            SELECT * FROM series_reader_state
            WHERE series_id = #{seriesId} AND user_id = #{userId}
            """)
    SeriesReaderState findBySeriesAndUser(String seriesId, String userId);

    @Select("""
            SELECT * FROM series_reader_state
            WHERE user_id = #{userId} AND last_read_at IS NOT NULL
            ORDER BY last_read_at DESC
            LIMIT #{limit}
            """)
    List<SeriesReaderState> listRecentByUser(String userId, int limit);

    /**
     * 记录/覆盖某用户在某系列的阅读位置（Phase 3C，2026-10-19）。
     *
     * <p>唯一键 {@code (series_id, user_id)} 决定了这里必须是 upsert，而不是
     * "先查再插/改"：快速连点章节时两个请求可能同时读到"无记录"，第二个 INSERT
     * 会撞唯一键，进度写入因此变成一个偶发失败。条件写在同一语句内也保证了
     * "最后写入的章节就是最后读到的章节"。
     *
     * <p>{@code following} 不在更新列里：它是追更标记，与阅读位置是两件事，
     * 进度写入不得顺手把它归零。
     */
    @Insert("""
            INSERT INTO series_reader_state
                (id, series_id, user_id, last_read_article_id, last_read_at, following, created_at, updated_at)
            VALUES
                (#{id}, #{seriesId}, #{userId}, #{articleId}, #{readAt}, 0, #{readAt}, #{readAt})
            ON DUPLICATE KEY UPDATE
                last_read_article_id = VALUES(last_read_article_id),
                last_read_at = VALUES(last_read_at),
                updated_at = VALUES(updated_at)
            """)
    int upsertProgress(
            @Param("id") String id,
            @Param("seriesId") String seriesId,
            @Param("userId") String userId,
            @Param("articleId") String articleId,
            @Param("readAt") Instant readAt);
}
