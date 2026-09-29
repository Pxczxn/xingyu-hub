package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.TopicFollow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TopicFollowMapper extends BaseMapper<TopicFollow> {

    @Select("""
            SELECT * FROM topic_follow
            WHERE user_id = #{userId} AND topic_id = #{topicId}
            """)
    TopicFollow findByUserAndTopic(String userId, String topicId);

    @Delete("""
            DELETE FROM topic_follow
            WHERE user_id = #{userId} AND topic_id = #{topicId}
            """)
    int deleteByUserAndTopic(String userId, String topicId);

    @Select("SELECT COUNT(*) FROM topic_follow WHERE topic_id = #{topicId}")
    long countByTopicId(String topicId);

    @Select("SELECT * FROM topic_follow WHERE topic_id = #{topicId}")
    java.util.List<TopicFollow> listByTopicId(String topicId);
}
