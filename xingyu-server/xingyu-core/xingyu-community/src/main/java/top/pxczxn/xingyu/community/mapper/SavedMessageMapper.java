package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.SavedMessage;

import java.util.List;

@Mapper
public interface SavedMessageMapper extends BaseMapper<SavedMessage> {

    @Select("""
            SELECT * FROM saved_message
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<SavedMessage> listByUserId(String userId, int limit);

    @Select("""
            SELECT * FROM saved_message
            WHERE user_id = #{userId} AND message_id = #{messageId}
            LIMIT 1
            """)
    SavedMessage findByUserAndMessage(String userId, String messageId);
}
