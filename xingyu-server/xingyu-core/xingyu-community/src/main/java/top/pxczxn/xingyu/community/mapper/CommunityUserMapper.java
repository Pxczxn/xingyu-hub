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
     * 取用户行并加写锁（2026-10-08 新增，供邮箱换绑申请串行化使用）。
     *
     * <p><b>为什么需要</b>：换绑申请是「先查未消费 token → 全部作废 → 插入新 token」三步。
     * 两个并发申请若都查到「没有未消费 token」，就会各插一条，之后两个 token 都能被确认，
     * 换绑结果取决于用户先点哪个确认链接——这不是确定行为。
     *
     * <p>{@code FOR UPDATE} 把同一用户的并发申请串行化：第二个请求必须等第一个提交，
     * 于是它查到的就是第一个刚插入的那条 token，会被作废，只剩最后一个申请有效。
     *
     * <p><b>锁的范围</b>：单行锁（id 为主键），不同用户互不阻塞。
     * 调用方必须已在事务内（{@code changeEmail} 是 {@code @Transactional}），否则锁立即释放、失去意义。
     */
    @Select("SELECT * FROM community_user WHERE id = #{id} FOR UPDATE")
    CommunityUser findByIdForUpdate(@Param("id") String id);

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
