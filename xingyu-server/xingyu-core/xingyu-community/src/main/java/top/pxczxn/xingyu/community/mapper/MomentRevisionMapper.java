package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MomentRevisionMapper extends BaseMapper<MomentRevision> {

    @Select("""
            SELECT * FROM moment_revision
            WHERE moment_id = #{momentId}
            ORDER BY revision_number DESC
            LIMIT 1
            """)
    MomentRevision findLatestByMomentId(String momentId);

    @Select("""
            <script>
            SELECT r.* FROM moment_revision r
            INNER JOIN (
                SELECT moment_id, MAX(revision_number) AS revision_number
                FROM moment_revision
                WHERE moment_id IN
                <foreach collection='momentIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
                GROUP BY moment_id
            ) latest ON latest.moment_id = r.moment_id
                    AND latest.revision_number = r.revision_number
            </script>
            """)
    List<MomentRevision> listLatestByMomentIds(@Param("momentIds") List<String> momentIds);
}
