package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.CollaborationMember;

import java.util.List;

@Mapper
public interface CollaborationMemberMapper extends BaseMapper<CollaborationMember> {

    @Select("""
            SELECT * FROM collaboration_member
            WHERE owner_id = #{ownerId} AND member_id = #{memberId}
            LIMIT 1
            """)
    CollaborationMember findByOwnerAndMember(String ownerId, String memberId);

    @Select("""
            SELECT owner_id FROM collaboration_member
            WHERE member_id = #{memberId}
            ORDER BY created_at DESC
            """)
    List<String> listOwnerIdsByMemberId(String memberId);

    @Select("""
            SELECT * FROM collaboration_member
            WHERE owner_id = #{ownerId}
            ORDER BY created_at DESC, id ASC
            """)
    List<CollaborationMember> listByOwnerId(String ownerId);

    @Select("""
            SELECT * FROM collaboration_member
            WHERE member_id = #{memberId}
            ORDER BY created_at DESC, id ASC
            """)
    List<CollaborationMember> listByMemberId(String memberId);

    @Delete("""
            DELETE FROM collaboration_member
            WHERE owner_id = #{ownerId} AND member_id = #{memberId}
            """)
    int deleteByOwnerAndMember(String ownerId, String memberId);
}
