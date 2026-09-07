package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CollectionEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CollectionEntryMapper extends BaseMapper<CollectionEntry> {

    @Select("""
            SELECT * FROM collection_entry
            WHERE collection_id = #{collectionId}
            ORDER BY sort_order ASC, created_at ASC
            """)
    List<CollectionEntry> listByCollectionId(String collectionId);

    @Select("SELECT COUNT(*) FROM collection_entry WHERE collection_id = #{collectionId}")
    long countByCollectionId(String collectionId);

    @Select("""
            SELECT ce.* FROM collection_entry ce
            JOIN user_collection uc ON uc.id = ce.collection_id
            WHERE uc.owner_id = #{ownerId}
              AND ce.object_type = #{objectType}
              AND ce.object_id = #{objectId}
            LIMIT 1
            """)
    CollectionEntry findByOwnerAndObject(String ownerId, String objectType, String objectId);
}
