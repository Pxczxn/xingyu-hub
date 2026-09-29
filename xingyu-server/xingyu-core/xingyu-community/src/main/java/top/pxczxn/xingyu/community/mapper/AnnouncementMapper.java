package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Announcement;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AnnouncementMapper extends BaseMapper<Announcement> {

    @Select("""
            SELECT * FROM announcement
            WHERE status = 'PUBLISHED'
            ORDER BY published_at DESC
            LIMIT #{limit}
            """)
    List<Announcement> listPublished(int limit);

    @Select("""
            SELECT * FROM announcement
            ORDER BY created_at DESC
            """)
    List<Announcement> listAllForAdmin();
}
