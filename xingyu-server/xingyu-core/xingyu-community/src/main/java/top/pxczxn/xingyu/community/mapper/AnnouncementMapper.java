package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Announcement;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AnnouncementMapper extends BaseMapper<Announcement> {

    /*
     * `id DESC` 是纯技术 tie-breaker，不是业务语义。
     *
     * `published_at` 是 timestamp（秒精度），同秒发布的多条公告在该列上完全相等，
     * 只按它排序时 MySQL 不保证两次读取给出同一顺序 —— 列表会在刷新/分页之间
     * 自行重排。加上 `id DESC` 让顺序在数据不变时确定，仅此而已。
     *
     * 它**不**表示"同秒内 id 大的发布时间更晚"：uuid 的字典序与真实先后无关。
     * 想拿到真正的微秒先后需要改 schema（更高精度的时间列），本轮刻意不做。
     */
    @Select("""
            SELECT * FROM announcement
            WHERE status = 'PUBLISHED'
            ORDER BY published_at DESC, id DESC
            LIMIT #{limit}
            """)
    List<Announcement> listPublished(int limit);

    @Select("""
            SELECT * FROM announcement
            ORDER BY created_at DESC, id DESC
            """)
    List<Announcement> listAllForAdmin();
}
