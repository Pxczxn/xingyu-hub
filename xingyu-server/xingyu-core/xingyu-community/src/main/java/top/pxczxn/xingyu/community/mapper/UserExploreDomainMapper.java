package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.UserExploreDomain;

import java.util.List;

@Mapper
public interface UserExploreDomainMapper extends BaseMapper<UserExploreDomain> {

    @Delete("DELETE FROM user_explore_domain WHERE user_id = #{userId}")
    void deleteByUserId(String userId);

    @Select("""
            SELECT domain_id FROM user_explore_domain
            WHERE user_id = #{userId}
            ORDER BY sort_order ASC
            """)
    List<String> listDomainIdsByUser(String userId);
}
