package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.RecommendationFeedback;

import java.util.List;

@Mapper
public interface RecommendationFeedbackMapper extends BaseMapper<RecommendationFeedback> {

    @Select("""
            SELECT * FROM recommendation_feedback
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<RecommendationFeedback> listByUserId(String userId, int limit);
}
