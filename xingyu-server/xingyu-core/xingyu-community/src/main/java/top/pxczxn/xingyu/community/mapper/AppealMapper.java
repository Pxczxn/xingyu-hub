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
}
