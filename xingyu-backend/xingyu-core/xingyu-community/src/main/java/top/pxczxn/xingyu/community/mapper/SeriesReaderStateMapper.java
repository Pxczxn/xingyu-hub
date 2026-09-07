package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SeriesReaderState;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

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
}
