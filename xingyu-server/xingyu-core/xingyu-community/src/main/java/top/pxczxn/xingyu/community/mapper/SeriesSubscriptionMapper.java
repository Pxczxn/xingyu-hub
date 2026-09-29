package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.SeriesSubscription;

import java.util.List;

@Mapper
public interface SeriesSubscriptionMapper extends BaseMapper<SeriesSubscription> {

    @Select("""
            SELECT * FROM series_subscription
            WHERE user_id = #{userId} AND series_id = #{seriesId}
            LIMIT 1
            """)
    SeriesSubscription findByUserAndSeries(String userId, String seriesId);

    @Select("""
            SELECT * FROM series_subscription
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<SeriesSubscription> listByUserId(String userId, int limit);
}
