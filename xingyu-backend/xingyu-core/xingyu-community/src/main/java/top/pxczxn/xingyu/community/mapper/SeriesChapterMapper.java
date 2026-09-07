package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SeriesChapterMapper extends BaseMapper<SeriesChapter> {

    @Select("""
            SELECT * FROM series_chapter
            WHERE series_id = #{seriesId}
            ORDER BY position ASC
            """)
    List<SeriesChapter> listBySeriesId(String seriesId);

    @Delete("DELETE FROM series_chapter WHERE series_id = #{seriesId}")
    int deleteBySeriesId(String seriesId);

    @Select("SELECT COUNT(*) FROM series_chapter WHERE series_id = #{seriesId}")
    long countBySeriesId(String seriesId);
}
