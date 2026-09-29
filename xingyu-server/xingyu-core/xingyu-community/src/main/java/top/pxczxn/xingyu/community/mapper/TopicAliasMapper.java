package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.TopicAlias;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TopicAliasMapper extends BaseMapper<TopicAlias> {

    @Select("SELECT * FROM topic_alias WHERE alias_slug = #{aliasSlug} LIMIT 1")
    TopicAlias findByAliasSlug(String aliasSlug);

    @Select("SELECT * FROM topic_alias WHERE topic_id = #{topicId} ORDER BY alias_slug ASC")
    java.util.List<TopicAlias> listByTopicId(String topicId);
}
