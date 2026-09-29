package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CommunityUserMapper extends BaseMapper<CommunityUser> {

    @Select("SELECT * FROM community_user WHERE email = #{email} LIMIT 1")
    CommunityUser findByEmail(String email);

    @Select("SELECT * FROM community_user WHERE phone = #{phone} LIMIT 1")
    CommunityUser findByPhone(String phone);

    /**
     * 管理端社区用户列表：服务端分页（第一个参数为 MyBatis-Plus 分页对象，由分页插件自动追加 COUNT 与 LIMIT）。
     * 排序以 created_at DESC 为主、cu.id DESC 为次级，保证翻页稳定不漂移。
     * 角色筛选与前端 matchesCommunityUserRole 等价：user 含 user/member 且 null/空视为 user。
     */
    @Select("""
            <script>
            SELECT DISTINCT cu.*
            FROM community_user cu
            LEFT JOIN community_profile cp ON cp.user_id = cu.id
            <where>
              <if test="status != null and status != ''">
                AND cu.status = #{status}
              </if>
              <if test="keyword != null and keyword != ''">
                AND (
                  LOWER(cu.id) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(cu.email) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(cp.username) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(cp.display_name) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(cp.bio) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR cu.phone LIKE CONCAT('%', #{keyword}, '%')
                )
              </if>
              <if test="role != null and role != ''">
                <choose>
                  <when test="role == 'user'">AND (LOWER(cu.role) IN ('user', 'member') OR cu.role IS NULL OR cu.role = '')</when>
                  <when test="role == 'creator'">AND LOWER(cu.role) = 'creator'</when>
                  <when test="role == 'admin'">AND LOWER(cu.role) = 'admin'</when>
                  <otherwise>AND LOWER(cu.role) = #{role}</otherwise>
                </choose>
              </if>
            </where>
            ORDER BY cu.created_at DESC, cu.id DESC
            </script>
            """)
    IPage<CommunityUser> listForAdmin(
            IPage<CommunityUser> page,
            @Param("status") String status,
            @Param("keyword") String keyword,
            @Param("role") String role);
}
