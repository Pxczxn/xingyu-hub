package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

import top.pxczxn.xingyu.community.dto.ObjectCountRow;

@Mapper
public interface SeriesChapterMapper extends BaseMapper<SeriesChapter> {

    @Select("""
            SELECT * FROM series_chapter
            WHERE series_id = #{seriesId}
            ORDER BY position ASC
            """)
    List<SeriesChapter> listBySeriesId(String seriesId);

    @Select("""
            <script>
            SELECT * FROM series_chapter
            WHERE series_id IN
            <foreach collection='seriesIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            ORDER BY series_id ASC, position ASC
            </script>
            """)
    List<SeriesChapter> listBySeriesIds(@Param("seriesIds") List<String> seriesIds);

    @Delete("DELETE FROM series_chapter WHERE series_id = #{seriesId}")
    int deleteBySeriesId(String seriesId);

    @Select("SELECT COUNT(*) FROM series_chapter WHERE series_id = #{seriesId}")
    long countBySeriesId(String seriesId);

    @Select("""
            <script>
            SELECT series_id AS objectId, COUNT(*) AS count
            FROM series_chapter
            WHERE series_id IN
            <foreach collection='seriesIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            GROUP BY series_id
            </script>
            """)
    List<ObjectCountRow> countBySeriesIds(@Param("seriesIds") List<String> seriesIds);

    @Insert("""
            <script>
            INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
            VALUES
            <foreach collection='chapters' item='chapter' separator=','>
            (#{chapter.id}, #{chapter.seriesId}, #{chapter.articleId}, #{chapter.position}, #{chapter.createdAt})
            </foreach>
            </script>
            """)
    int insertAll(@Param("chapters") List<SeriesChapter> chapters);
}
