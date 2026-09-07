package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.UsernameHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UsernameHistoryMapper extends BaseMapper<UsernameHistory> {

    @Select("SELECT * FROM username_history WHERE username = #{username} LIMIT 1")
    UsernameHistory findByUsername(String username);
}
