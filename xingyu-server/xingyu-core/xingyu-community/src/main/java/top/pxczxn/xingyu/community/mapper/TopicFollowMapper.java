package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.TopicFollow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

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

    @Select("""
            <script>
            SELECT topic_id AS objectId, COUNT(*) AS count
            FROM topic_follow
            WHERE topic_id IN
            <foreach collection='topicIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            GROUP BY topic_id
            </script>
            """)
    List<ObjectCountRow> countByTopicIds(@Param("topicIds") List<String> topicIds);

    @Select("""
            <script>
            SELECT topic_id FROM topic_follow
            WHERE user_id = #{userId}
              AND topic_id IN
              <foreach collection='topicIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            </script>
            """)
    List<String> listTopicIdsByUser(@Param("userId") String userId, @Param("topicIds") List<String> topicIds);

    @Select("SELECT * FROM topic_follow WHERE topic_id = #{topicId}")
    java.util.List<TopicFollow> listByTopicId(String topicId);
}
