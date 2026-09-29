package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.UserCollection;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CollectionMapper extends BaseMapper<UserCollection> {

    @Select("""
            SELECT * FROM collection
            WHERE owner_id = #{ownerId}
            ORDER BY updated_at DESC
            """)
    List<UserCollection> listByOwnerId(String ownerId);
}
