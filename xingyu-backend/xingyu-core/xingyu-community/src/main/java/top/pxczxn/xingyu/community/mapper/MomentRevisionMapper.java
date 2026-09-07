package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MomentRevisionMapper extends BaseMapper<MomentRevision> {

    @Select("""
            SELECT * FROM moment_revision
            WHERE moment_id = #{momentId}
            ORDER BY revision_number DESC
            LIMIT 1
            """)
    MomentRevision findLatestByMomentId(String momentId);
}
