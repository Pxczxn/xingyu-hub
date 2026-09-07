package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;
import top.pxczxn.xingyu.admin.controller.community.OperationsOverviewController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class OperationsOverviewIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private OperationsOverviewController operationsOverviewController;

    @BeforeEach
    void prepareLogin() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void adminCanReadCommunityOperationOverview() throws Exception {
        mockMvc.perform(get("/api/v1/admin/operations/overview")
                        .header("satoken", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pendingReviewCount").isNumber())
                .andExpect(jsonPath("$.data.openCaseCount").isNumber())
                .andExpect(jsonPath("$.data.publishedArticleCount").isNumber())
                .andExpect(jsonPath("$.data.activeEventCount").isNumber());

        OperationsOverviewController.OperationsOverview overview = operationsOverviewController.overview().getData();
        assertFalse(overview.getPendingReviewCount() == null, "待审核数量必须可读取");
        assertFalse(overview.getOpenCaseCount() == null, "治理案件数量必须可读取");
        assertFalse(overview.getPublishedArticleCount() == null, "已发布文章数量必须可读取");
        assertFalse(overview.getActiveEventCount() == null, "进行中活动数量必须可读取");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText();
        assertFalse(token.isBlank(), "管理员登录必须返回可用 token");
        return token;
    }
}
