package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Topic;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TopicMapper extends BaseMapper<Topic> {

    @Select("SELECT * FROM topic WHERE slug = #{slug} LIMIT 1")
    Topic findBySlug(String slug);

    @Select("SELECT * FROM topic WHERE seed_key = #{seedKey} LIMIT 1")
    Topic findBySeedKey(String seedKey);
}
