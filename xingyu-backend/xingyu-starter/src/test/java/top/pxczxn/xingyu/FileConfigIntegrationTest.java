package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FileConfigIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `sys_file_config` (
                  `id` bigint NOT NULL AUTO_INCREMENT,
                  `name` varchar(128) NOT NULL,
                  `storage_type` varchar(32) NOT NULL,
                  `master` tinyint NOT NULL DEFAULT 0,
                  `domain` varchar(512) NOT NULL DEFAULT '',
                  `base_path` varchar(512) DEFAULT NULL,
                  `bucket_name` varchar(128) DEFAULT NULL,
                  `access_key` varchar(256) DEFAULT NULL,
                  `secret_key` varchar(512) DEFAULT NULL,
                  `endpoint` varchar(512) DEFAULT NULL,
                  `region` varchar(64) DEFAULT NULL,
                  `status` tinyint NOT NULL DEFAULT 1,
                  `remark` varchar(512) DEFAULT NULL,
                  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    @Test
    void fileConfigCrudFlow() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/sys/file-config/list")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        mockMvc.perform(post("/api/v1/admin/sys/file-config")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"测试本地","storageType":"local","master":0,"domain":"http://localhost:7779","basePath":"runtime/uploads","status":1}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/sys/file-config/test")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"测试","storageType":"local","domain":"","basePath":"runtime/uploads","status":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText();
    }
}
