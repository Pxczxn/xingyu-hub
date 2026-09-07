package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommunityUserMapper extends BaseMapper<CommunityUser> {

    @Select("SELECT * FROM community_user WHERE email = #{email} LIMIT 1")
    CommunityUser findByEmail(String email);

    @Select("SELECT * FROM community_user WHERE phone = #{phone} LIMIT 1")
    CommunityUser findByPhone(String phone);

    @Select("""
            <script>
            SELECT DISTINCT cu.*
            FROM community_user cu
            LEFT JOIN community_profile cp ON cp.user_id = cu.id
            <where>
              <if test="status != null and status != ''">
                AND cu.status = #{status}
              </if>
              <if test="username != null and username != ''">
                AND LOWER(cp.username) LIKE CONCAT('%', LOWER(#{username}), '%')
              </if>
              <if test="email != null and email != ''">
                AND LOWER(cu.email) LIKE CONCAT('%', LOWER(#{email}), '%')
              </if>
              <if test="phone != null and phone != ''">
                AND cu.phone LIKE CONCAT('%', #{phone}, '%')
              </if>
              <if test="keyword != null and keyword != ''">
                AND (
                  LOWER(cu.email) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(cp.username) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR cu.phone LIKE CONCAT('%', #{keyword}, '%')
                )
              </if>
            </where>
            ORDER BY cu.created_at DESC
            LIMIT #{limit}
            </script>
            """)
    List<CommunityUser> listForAdmin(
            @Param("status") String status,
            @Param("username") String username,
            @Param("email") String email,
            @Param("phone") String phone,
            @Param("keyword") String keyword,
            @Param("limit") int limit);
}
