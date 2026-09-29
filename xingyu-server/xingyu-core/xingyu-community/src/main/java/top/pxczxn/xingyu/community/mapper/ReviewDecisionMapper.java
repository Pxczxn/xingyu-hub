package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ReviewDecision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReviewDecisionMapper extends BaseMapper<ReviewDecision> {

    @Select("SELECT * FROM review_decision WHERE submission_id = #{submissionId} LIMIT 1")
    ReviewDecision findBySubmissionId(String submissionId);
}
