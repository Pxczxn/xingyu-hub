package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

/**
 * Admin Permission Annotation Enforcement 权限矩阵回归（2026-10-10）。
 *
 * <p>背景：AOP CGLIB 代理丢失方法注解导致 @SaCheckPermission 全体失效；修复为
 * SaTokenConfig 静态块把 SaStrategy.getAnnotation 换成 Spring AnnotationUtils.findAnnotation
 * （穿透代理）。本测试用三个专用 sys_user 钉死细粒度权限编码真实生效。
 *
 * <p>管理端错误契约：HTTP 200 + body.code（401/403），断言业务码。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminPermissionAnnotationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    private final List<Long> sysUserIds = new ArrayList<>();
    private final List<Long> sysRoleIds = new ArrayList<>();

    private String adminToken;
    private String noPermToken;   // 无任何角色
    private String listOnlyToken; // 仅 sys:user:list
    private String addEditToken;  // sys:user:add + edit（role2 派生，无 delete 断言用 add 代表）

    @org.junit.jupiter.api.BeforeAll
    void setUp() throws Exception {
        adminToken = login("admin");
        noPermToken = seedUser("paenull", null, List.of());
        listOnlyToken = seedUser("paelist", "admin", List.of("sys:user:list"));
        addEditToken = seedUser("paeadd", "admin", List.of("sys:user:add", "sys:user:edit"));
    }

    @AfterAll
    void tearDown() {
        for (Long userId : sysUserIds) {
            jdbcTemplate.update("DELETE FROM sys_user_role WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM sys_user WHERE id = ?", userId);
        }
        for (Long roleId : sysRoleIds) {
            jdbcTemplate.update("DELETE FROM sys_role_menu WHERE role_id = ?", roleId);
            jdbcTemplate.update("DELETE FROM sys_role WHERE id = ?", roleId);
        }
        jdbcTemplate.update("DELETE FROM sys_user WHERE username = 'shouldnotexist'");
        sysUserIds.clear();
        sysRoleIds.clear();
    }

    // ---- 矩阵 ----

    @Test
    @Order(1)
    void noTokenAndCommunityIsolationRemain() throws Exception {
        mockMvc.perform(get("/api/v1/admin/sys/user/page?page=1&pageSize=1"))
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @Order(2)
    void userListPermissionIsEnforcedPerEncoding() throws Exception {
        // 无任何权限账号：sys:user:list 拒绝（修复前 auditnull 同请求为 200）
        mockMvc.perform(get("/api/v1/admin/sys/user/page?page=1&pageSize=1").header("satoken", noPermToken))
                .andExpect(jsonPath("$.code").value(403));
        // 仅 sys:user:list：查询允许
        mockMvc.perform(get("/api/v1/admin/sys/user/page?page=1&pageSize=1").header("satoken", listOnlyToken))
                .andExpect(jsonPath("$.code").value(200));
        // 合法管理员：允许
        mockMvc.perform(get("/api/v1/admin/sys/user/page?page=1&pageSize=1").header("satoken", adminToken))
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @Order(3)
    void fineGrainedEncodingsDistinguishListFromWrite() throws Exception {
        // 仅 list：无 sys:user:add → 新建用户拒绝，且零 DB 副作用
        Integer before = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user WHERE username = 'shouldnotexist'", Integer.class);
        mockMvc.perform(post("/api/v1/admin/sys/user").header("satoken", listOnlyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"shouldnotexist\",\"password\":\"Xy9-abc-def\",\"nickname\":\"x\"}"))
                .andExpect(jsonPath("$.code").value(403));
        Integer after = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user WHERE username = 'shouldnotexist'", Integer.class);
        assertEquals(before, after, "被拒请求不得产生 sys_user 行");

        // 有 sys:user:add + edit：新建允许（真实写操作，专用 fixture）
        mockMvc.perform(post("/api/v1/admin/sys/user").header("satoken", addEditToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"user\":{\"username\":\"shouldnotexist\",\"password\":\"Xy9-abc-def\","
                                + "\"nickname\":\"gate-created\",\"userType\":\"admin\"},\"roleIds\":[],\"postIds\":[]}"))
                .andExpect(jsonPath("$.code").value(200));
        Integer created = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user WHERE username = 'shouldnotexist'", Integer.class);
        assertEquals(1, created, "持 sys:user:add 的账号应能真实创建用户");

        // 无 sys:user:delete：删除拒绝（用 shouldnotexist 的 id）
        Long createdId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_user WHERE username = 'shouldnotexist'", Long.class);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/admin/sys/user/" + createdId).header("satoken", addEditToken))
                .andExpect(jsonPath("$.code").value(403));
        // admin 删除（清理 + 验证 delete 权限链路）
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/admin/sys/user/" + createdId).header("satoken", adminToken))
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @Order(4)
    void crossDomainPermissionEncodingsAreEnforced() throws Exception {
        // 仅 user:list：notice 域（sys:notice:list）拒绝 —— 细粒度跨域隔离
        mockMvc.perform(get("/api/v1/admin/sys/notice/page?page=1&pageSize=1").header("satoken", listOnlyToken))
                .andExpect(jsonPath("$.code").value(403));
        // admin：notice 域允许
        mockMvc.perform(get("/api/v1/admin/sys/notice/page?page=1&pageSize=1").header("satoken", adminToken))
                .andExpect(jsonPath("$.code").value(200));
        // 无权限账号：notice 域拒绝
        mockMvc.perform(get("/api/v1/admin/sys/notice/page?page=1&pageSize=1").header("satoken", noPermToken))
                .andExpect(jsonPath("$.code").value(403));
    }

    // ---- helpers ----

    private String login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    /** 建 sys_user（userType 可空）+ 专用角色（绑定给定权限编码对应的全部菜单）。 */
    private String seedUser(String prefix, String userType, List<String> permissions) throws Exception {
        long id = 99100L + sysUserIds.size() + 1;
        String passwordHash = jdbcTemplate.queryForObject(
                "SELECT password FROM sys_user WHERE id = 1", String.class);
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, username, password, nickname, user_type, status)
                VALUES (?, ?, ?, ?, ?, 1)
                """, id, prefix + id, passwordHash, prefix + "-nick", userType);
        long roleId = 99100L + sysRoleIds.size() + 1;
        jdbcTemplate.update("INSERT INTO sys_role (id, name, code, status, deleted) VALUES (?, ?, ?, 1, 0)",
                roleId, prefix + "-role", prefix + "-role");
        sysRoleIds.add(roleId);
        for (String permission : permissions) {
            List<Long> menuIds = jdbcTemplate.queryForList(
                    "SELECT id FROM sys_menu WHERE permission = ? AND deleted = 0", Long.class, permission);
            for (Long menuId : menuIds) {
                jdbcTemplate.update("INSERT INTO sys_role_menu (role_id, menu_id) VALUES (?, ?)", roleId, menuId);
            }
        }
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        sysUserIds.add(id);
        // 手动 SQL 改角色绕过了生产侧 clearPermissionCache —— 登录前清 sa-token
        // session 权限缓存，避免读到本测试早前轮次留下的旧权限集合。
        java.util.Set<String> sessionKeys = stringRedisTemplate.keys("satoken:login:session:" + id);
        if (sessionKeys != null && !sessionKeys.isEmpty()) {
            stringRedisTemplate.delete(sessionKeys);
        }
        MvcResult login = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + prefix + id + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }
}
