package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Galaxy;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GalaxyMapper extends BaseMapper<Galaxy> {

    @Select("SELECT * FROM galaxy ORDER BY official DESC, name ASC")
    List<Galaxy> listAll();

    @Select("SELECT * FROM galaxy WHERE slug = #{slug} LIMIT 1")
    Galaxy findBySlug(String slug);
}
