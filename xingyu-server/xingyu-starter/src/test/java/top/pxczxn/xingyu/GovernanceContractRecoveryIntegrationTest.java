package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 治理闭环的契约恢复（Governance Contract Recovery）。
 *
 * <p>覆盖四件本轮定义的事：
 * <ol>
 *   <li><b>Appeal 结果契约</b>：approve / reject 必须落不同且可读的 outcome，
 *       不再都写 DECIDED；用户 DTO 必须能结构化回答"批准还是驳回"。</li>
 *   <li><b>Appeal 产品对象</b>：只有被措施实际影响的 owner 能申诉；举报人不能。</li>
 *   <li><b>objectType 白名单</b>：USER / SERIES 这类会被 MeasureExecutor 静默 no-op 的类型，
 *       服务端直接拒绝，绝不产生"举报成功却什么都不会发生"的假闭环。</li>
 *   <li><b>重复举报 / 自举报</b>：同一用户对同一对象的未终结举报只允许一条；不能举报自己。</li>
 * </ol>
 * 全部走真实业务路径（HTTP + admin HTTP），不直接写治理表。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GovernanceContractRecoveryIntegrationTest {

    /** 邮箱前缀，用于清理定位（email 无字符集限制）。 */
    private static final String PREFIX = "govrec-";
    /** 用户名必须匹配 ^[a-z0-9_]{3,32}$ —— 只能是这些字符，故另用一套合法前缀。 */
    private static final String USER_PREFIX = "govrec";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
        cleanup();
        adminToken = adminToken();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    /**
     * 纯 DML 清理（Test Infrastructure Gate Recovery，2026-10-09）。
     *
     * <p>历史实现用 {@code jdbcTemplate.execute} 建临时普通表来物化 ID 集合，
     * 被静态门禁判定为测试源码改 schema。现在改为把 ID 集合收进 Java 侧 List，
     * 再经 {@link NamedParameterJdbcTemplate} 以 IN 列表下发 —— 语义与旧临时表完全等价：
     * <ul>
     *   <li>规避 error 1093：删除目标表永远不出现在子查询的 FROM 里（旧实现靠中间表
     *       达成的效果，现在由"先查 ID 进 List、再按 List 删"达成）。</li>
     *   <li>锚点复用：anchor / reports / cases / articles 四个 List 贯穿全部 DELETE
     *       与闭合断言，不再需要"同一条语句里被多次引用"的普通表。</li>
     *   <li>并行安全：定位仍只靠本类专属前缀（email / username），与旧实现一致。</li>
     * </ul>
     *
     * <p>顺序不变：先删所有子行，再删父行。若先删 community_user，后续按 user 反查的
     * 子行查询会全部落空 → 留下孤儿 report/case/appeal（历史上真实发生过，18 profile /
     * 10 report 残留）。
     */
    private void cleanup() {
        NamedParameterJdbcTemplate np = new NamedParameterJdbcTemplate(jdbcTemplate);
        Map<String, Object> prefixParams = Map.of(
                "email", PREFIX + "%@example.com",
                "username", USER_PREFIX + "%");

        // 用户身份锚点有两个，且必须都收：
        //   - community_user.email（community_user 无 username，username 在 community_profile）
        //   - community_profile.username（用于兜住"user 行已删、profile 成孤儿"的中间态）
        List<String> anchor = new ArrayList<>();
        anchor.addAll(np.queryForList(
                "SELECT id FROM community_user WHERE email LIKE :email", prefixParams, String.class));
        anchor.addAll(np.queryForList(
                "SELECT user_id FROM community_profile WHERE username LIKE :username", prefixParams, String.class));
        if (anchor.isEmpty()) {
            return;
        }
        Map<String, Object> userParams = Map.of("users", anchor);

        // 举报：举报人是锚点，或举报对象是锚点拥有的 moment/comment/article。
        List<String> reportIds = np.queryForList("""
                SELECT r.id FROM report r WHERE r.reporter_id IN (:users)
                   OR r.object_id IN (SELECT id FROM moment  WHERE author_id IN (:users))
                   OR r.object_id IN (SELECT id FROM comment WHERE author_id IN (:users))
                   OR r.object_id IN (SELECT id FROM article WHERE owner_id IN (:users))
                """, userParams, String.class);
        List<String> caseIds = reportIds.isEmpty() ? List.of() : np.queryForList(
                "SELECT id FROM moderation_case WHERE report_id IN (:reports)",
                Map.of("reports", reportIds), String.class);

        if (!caseIds.isEmpty()) {
            Map<String, Object> caseParams = Map.of("cases", caseIds);
            np.update("DELETE FROM moderation_measure WHERE decision_id IN "
                    + "(SELECT id FROM moderation_decision WHERE case_id IN (:cases))", caseParams);
            np.update("DELETE FROM moderation_decision WHERE case_id IN (:cases)", caseParams);
            np.update("DELETE FROM appeal WHERE case_id IN (:cases)", caseParams);
            np.update("DELETE FROM moderation_case WHERE id IN (:cases)", caseParams);
        }
        if (!reportIds.isEmpty()) {
            Map<String, Object> reportParams = Map.of("reports", reportIds);
            np.update("DELETE FROM report_supplement WHERE report_id IN (:reports)", reportParams);
            np.update("DELETE FROM report WHERE id IN (:reports)", reportParams);
        }

        // 内容对象：先清索引（避免留下指向已删对象的孤儿 search_document），再删内容。
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM moment WHERE author_id IN (:users))", userParams);
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM comment WHERE author_id IN (:users))", userParams);
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM article WHERE owner_id IN (:users))", userParams);

        np.update("DELETE FROM comment WHERE author_id IN (:users)", userParams);
        np.update("DELETE FROM moment WHERE author_id IN (:users)", userParams);

        // 文章流水线：decision → submission → published_revision → working_draft →
        // article_topic → formal_revision → article，子→父顺序。
        List<String> articleIds = np.queryForList(
                "SELECT id FROM article WHERE owner_id IN (:users)", userParams, String.class);
        if (!articleIds.isEmpty()) {
            Map<String, Object> articleParams = Map.of("articles", articleIds);
            np.update("DELETE FROM review_decision WHERE submission_id IN "
                    + "(SELECT id FROM review_submission WHERE article_id IN (:articles))", articleParams);
            np.update("DELETE FROM review_submission WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM published_revision WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM working_draft WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM article_topic WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM formal_revision WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM article WHERE id IN (:articles)", articleParams);
        }

        np.update("DELETE FROM community_session WHERE user_id IN (:users)", userParams);
        np.update("DELETE FROM community_profile WHERE user_id IN (:users)", userParams);
        np.update("DELETE FROM community_user WHERE id IN (:users)", userParams);

        // 基线闭合证明：删完之后，本 fixture 相关的 7 张治理表与内容/索引都必须为 0。
        // 断言而不是"相信 DELETE"——WHERE 关联写错会静默漏删（历史上真实发生过残留）。
        assertGovernanceTablesClean(np, anchor, reportIds, caseIds, articleIds);
    }

    /**
     * 7 张治理表 + 相关内容/SearchDocument 回到基线（本 fixture 0 行残留）。
     *
     * <p>用 Java 侧的 ID 集合定位本 fixture 的行，再沿真实外键反查各表。
     * 注意 report.reporter_id 落的是 community_user.id（无 username），
     * 而 community_profile 用 user_id 反关联 —— 两套锚点都要用上。
     */
    private void assertGovernanceTablesClean(NamedParameterJdbcTemplate np,
                                             List<String> anchor, List<String> reportIds,
                                             List<String> caseIds, List<String> articleIds) {
        Map<String, Object> userParams = Map.of("users", anchor);
        assertEquals(0L, count(np,
                "SELECT COUNT(*) FROM community_user WHERE id IN (:users)", userParams),
                "community_user 不得残留本 fixture 的行");

        assertEquals(0L, count(np,
                "SELECT COUNT(*) FROM report WHERE reporter_id IN (:users)", userParams),
                "report 不得残留本 fixture 的行");

        // reportIds/caseIds/articleIds 可能为空（本 fixture 没造过对应行）：
        // IN () 是语法错误，空集合直接视为干净，跳过断言。
        if (reportIds.isEmpty() && caseIds.isEmpty() && articleIds.isEmpty()) {
            return;
        }
        if (!reportIds.isEmpty()) {
            Map<String, Object> reportParams = Map.of("reports", reportIds);
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM report_supplement WHERE report_id IN (:reports)", reportParams),
                    "report_supplement 不得残留本 fixture 的行");
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM moderation_case WHERE report_id IN (:reports)", reportParams),
                    "moderation_case 不得残留本 fixture 的行");
        }
        if (!caseIds.isEmpty()) {
            Map<String, Object> caseParams = Map.of("cases", caseIds);
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM moderation_decision WHERE case_id IN (:cases)", caseParams),
                    "moderation_decision 不得残留本 fixture 的行");
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM moderation_measure WHERE decision_id IN "
                            + "(SELECT id FROM moderation_decision WHERE case_id IN (:cases))", caseParams),
                    "moderation_measure 不得残留本 fixture 的行");
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM appeal WHERE case_id IN (:cases)", caseParams),
                    "appeal 不得残留本 fixture 的行");
        }

        assertEquals(0L, count(np,
                "SELECT COUNT(*) FROM moment WHERE author_id IN (:users)", userParams),
                "moment 不得残留本 fixture 的行");

        assertEquals(0L, count(np,
                "SELECT COUNT(*) FROM comment WHERE author_id IN (:users)", userParams),
                "comment 不得残留本 fixture 的行");

        assertEquals(0L, count(np,
                "SELECT COUNT(*) FROM article WHERE owner_id IN (:users)", userParams),
                "article 不得残留本 fixture 的行");

        if (!articleIds.isEmpty()) {
            assertEquals(0L, count(np,
                    "SELECT COUNT(*) FROM search_document WHERE object_id IN (:articles)",
                    Map.of("articles", articleIds)),
                    "search_document 不得残留本 fixture 的行");
        }
    }

    private long count(NamedParameterJdbcTemplate np, String sql, Map<String, Object> params) {
        Long n = np.queryForObject(sql, params, Long.class);
        return n == null ? 0L : n;
    }

    // ---------------------------------------------------------------
    // 1. Appeal 结果契约
    // ---------------------------------------------------------------

    @Test
    void approvedAppealPersistsApprovedOutcomeAndRestoresObject() throws Exception {
        Fixture f = buildHiddenMoment();

        String appealId = submitAppeal(f.authorToken, f.caseId, f.measureId, "我认为没有违规");
        decideAppeal(appealId, "APPROVED", "申诉成立，恢复内容");

        // 结构化回答：状态、outcome、处理人、处理时间、说明，全部落库。
        assertEquals("APPROVED", appealStatus(appealId), "批准后 status 必须是 APPROVED");
        assertEquals("APPROVED", appealOutcome(appealId), "批准后 outcome 必须持久化");
        assertNotNull(appealDecidedAt(appealId), "批准后必须有处理时间");
        assertNotNull(appealDecidedBy(appealId), "批准后必须有处理人");

        // 用户 DTO 必须能读出结果。
        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", f.authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.outcome").value("APPROVED"))
                .andExpect(jsonPath("$.decisionNote").value("申诉成立，恢复内容"));

        // 措施真实回退：对象重新可见。
        assertEquals("PUBLISHED", momentStatus(f.momentId), "批准后对象必须回到 PUBLISHED");
    }

    @Test
    void rejectedAppealPersistsRejectedOutcomeAndKeepsObjectHidden() throws Exception {
        Fixture f = buildHiddenMoment();

        String appealId = submitAppeal(f.authorToken, f.caseId, f.measureId, "我要求恢复");
        decideAppeal(appealId, "REJECTED", "维持原决定");

        // 关键回归：驳回必须是 REJECTED，而不是与批准同为 DECIDED。
        assertEquals("REJECTED", appealStatus(appealId), "驳回后 status 必须是 REJECTED");
        assertEquals("REJECTED", appealOutcome(appealId), "驳回后 outcome 必须持久化，and 与批准可区分");

        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", f.authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.outcome").value("REJECTED"));

        // 原措施保持：对象仍然隐藏。
        assertEquals("HIDDEN", momentStatus(f.momentId), "驳回后对象必须保持隐藏");
    }

    // ---------------------------------------------------------------
    // 1b. 两条闭环 × 代表性对象（Comment / Article）：走真实业务路径
    //     + 用户 DTO 必须携带「原处理对象 / 原决定」链
    // ---------------------------------------------------------------

    @Test
    void approvedAppealOnCommentRestoresItAndExposesTheOriginalObjectChain() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorName = USER_PREFIX + "cmtowner" + (nonce % 100_000_000L);
        String reporterName = USER_PREFIX + "cmtreporter" + (nonce % 100_000_000L);
        register(authorName + "@example.com", authorName, password);
        register(reporterName + "@example.com", reporterName, password);
        String authorToken = login(authorName + "@example.com", password);
        String reporterToken = login(reporterName + "@example.com", password);

        // 真实路径：作者发动态 → 作者在其下发评论 → 他人举报评论 → 管理员隐藏。
        String hostMoment = createMoment(authorToken, PREFIX + "承载评论的动态");
        String commentId = createComment(authorToken, "MOMENT", hostMoment, PREFIX + "被治理评论");
        String reportId = submitReport(reporterToken, "COMMENT", commentId, "HARASSMENT");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        String measureId = latestMeasureId(caseId);
        assertEquals("HIDDEN", commentStatus(commentId), "fixture 前置：评论必须被隐藏");

        String appealId = submitAppeal(authorToken, caseId, measureId, "评论没有违规");
        decideAppeal(appealId, "APPROVED", "申诉成立，恢复评论");

        // 内容真实恢复（COMMENT 恢复写 VISIBLE，不是 ACTIVE —— P0-1 的回归面）。
        assertEquals("VISIBLE", commentStatus(commentId), "批准后评论必须恢复为 VISIBLE");

        // 用户侧申诉 DTO 必须能说明「原处理对象 / 原决定」，而不是只有 caseId。
        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.targetType").value("COMMENT"))
                .andExpect(jsonPath("$.targetId").value(commentId))
                .andExpect(jsonPath("$.measureType").isNotEmpty())
                // 摘要来自真实评论正文，证明描述是服务端现查的。
                .andExpect(jsonPath("$.targetSummary").value(org.hamcrest.Matchers.containsString("被治理评论")));

        // 评论不参与索引：无论隐藏还是恢复，都不得产生 search_document 行。
        assertEquals(0, searchDocumentCount("COMMENT", commentId), "评论绝不进入搜索索引");
    }

    @Test
    void rejectedAppealOnArticleKeepsItHidden() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorName = USER_PREFIX + "artowner" + (nonce % 100_000_000L);
        String reporterName = USER_PREFIX + "artreporter" + (nonce % 100_000_000L);
        register(authorName + "@example.com", authorName, password);
        register(reporterName + "@example.com", reporterName, password);
        String authorToken = login(authorName + "@example.com", password);
        String reporterToken = login(reporterName + "@example.com", password);

        // 真实发布流水线：创建 → 草稿 → 提交 → 管理员审核通过。
        String articleId = publishArticle(authorToken, PREFIX + "被治理文章");
        String reportId = submitReport(reporterToken, "ARTICLE", articleId, "PLAGIARISM");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        String measureId = latestMeasureId(caseId);

        // 前置：文章必须真的被隐藏。
        // 注意 oracle 的选择：Article 的审核隐藏写的是 `article.moderation_status`
        // （NORMAL/HIDDEN，见 V029 + ArticleStateSupport），**不是** `article.status`
        // （那个是生命周期状态 PUBLISHED/DRAFT，隐藏时不会翻转）。这也正是
        // GovernanceCrossModuleVisibilityIntegrationTest 断言文章隐藏时用"非作者详情 404"
        // 而不是读 status 列的原因。这里两层都用：先验列，再验读路径确实失效。
        assertEquals("HIDDEN", articleModerationStatus(articleId), "fixture 前置：文章审核状态必须被隐藏");
        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());

        String appealId = submitAppeal(authorToken, caseId, measureId, "不存在抄袭");
        decideAppeal(appealId, "REJECTED", "维持原决定");

        assertEquals("REJECTED", appealStatus(appealId));
        // 驳回后文章必须保持隐藏：列不变 + 读路径仍然 404。
        assertEquals("HIDDEN", articleModerationStatus(articleId), "驳回后文章审核状态必须保持隐藏");
        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());

        // DTO 的「原处理对象」链在 Article 上也必须成立，且标题来自真实正式版本。
        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("REJECTED"))
                .andExpect(jsonPath("$.targetType").value("ARTICLE"))
                .andExpect(jsonPath("$.targetId").value(articleId))
                .andExpect(jsonPath("$.targetTitle").value(org.hamcrest.Matchers.containsString("被治理文章")));
    }

    // ---------------------------------------------------------------
    // 2. Appeal 产品对象 + terminal 拒绝重复处理
    // ---------------------------------------------------------------

    @Test
    void onlyAffectedOwnerCanAppealAndReporterCannot() throws Exception {
        Fixture f = buildHiddenMoment();

        // 举报人（非 owner）对同一案件的措施提出申诉 → 404，不泄露存在性。
        mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", f.reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"举报人不服"}
                                """.formatted(f.caseId, f.measureId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void terminalAppealCannotBeDecidedTwice() throws Exception {
        Fixture f = buildHiddenMoment();
        String appealId = submitAppeal(f.authorToken, f.caseId, f.measureId, "第一次申诉");
        decideAppeal(appealId, "APPROVED", "批准");
        int measuresAfterFirst = measureCount(f.caseId);

        // 第二次处理必须被拒绝。
        //
        // 注意响应形态：admin 端点走 GlobalExceptionHandler（basePackages 覆盖
        // top.pxczxn.xingyu.admin，含本 controller 的包），ContractException 会被
        // handleRuntimeException 接住 → HTTP 200 + Result.fail(message)，即 code=500。
        // 这是项目既有的 admin 响应约定（admin SPA 的 request.ts 正是靠 res.code !== 200
        // 判定失败并弹 message），不是鉴权/状态机失效。故此处断言"业务被拒绝"的
        // 可证伪形态：HTTP 200 + body.code != 200 + message 命中冲突语义。
        MvcResult second = mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(second.getResponse().getContentAsString());
        assertTrue(body.path("code").asInt() != 200,
                "第二次处理必须被业务拒绝（body.code != 200），实际: " + body);

        // 且不得改变结果、不得重复执行 measure。
        assertEquals("APPROVED", appealStatus(appealId), "重复处理不得改写已有的终局 status");
        assertEquals("APPROVED", appealOutcome(appealId), "重复处理不得改写已有的终局 outcome");
        assertEquals("PUBLISHED", momentStatus(f.momentId), "重复处理不得二次执行 measure");
        assertEquals(measuresAfterFirst, measureCount(f.caseId), "重复处理不得产生新的 measure 记录");
    }

    @Test
    void caseWithoutAnyMeasureCannotBeAppealed() throws Exception {
        Fixture f = buildHiddenMoment();
        // 先驳回该举报（不产生 measure），随后 owner 试图申诉 → 无措施可申诉。
        // 这里用"删掉 measure"来构造"无措施"的历史行，模拟旧数据/无措施的 case。
        jdbcTemplate.update("DELETE FROM moderation_measure WHERE decision_id IN "
                + "(SELECT id FROM moderation_decision WHERE case_id = ?)", f.caseId);

        mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", f.authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","detail":"凭空申诉"}
                                """.formatted(f.caseId)))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------
    // 3. objectType 白名单
    // ---------------------------------------------------------------

    @Test
    void unsupportedObjectTypesAreRejectedServerSide() throws Exception {
        Fixture f = buildHiddenMoment();
        // USER / SERIES 会被 MeasureExecutor 静默 no-op → 必须服务端拒绝，不能只靠前端隐藏。
        for (String type : List.of("USER", "SERIES", "GALAXY", "ARBITRARY")) {
            mockMvc.perform(post("/api/v1/reports")
                            .header("satoken", f.reporterToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"objectType":"%s","objectId":"whatever","reason":"SPAM"}
                                    """.formatted(type)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ---------------------------------------------------------------
    // 4. 重复举报 / 自举报
    // ---------------------------------------------------------------

    @Test
    void duplicateActiveReportReturnsTheExistingOneInsteadOfCreatingASecond() throws Exception {
        Fixture f = buildHiddenMoment();

        // 场景：清掉本 fixture 的治理痕迹，让"同一用户对同一对象"可重复提交。
        // 直接用一个新的干净对象来测重复规则，避免与隐藏逻辑纠缠。
        String freshMoment = createMoment(f.authorToken, PREFIX + "重复举报对象");

        String first = submitReport(f.reporterToken, "MOMENT", freshMoment, "SPAM");
        String second = submitReport(f.reporterToken, "MOMENT", freshMoment, "SPAM");

        assertEquals(first, second, "同一用户对同一对象的未终结举报必须复用同一条，不得新建");
        // reporter_id 落的是 community_user.id（ModerationService: report.setReporterId(user.getId())），
        // 不是 community_profile.id。这里必须按 user_id 关联，否则子查询恒为 NULL、计数恒 0。
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM report WHERE object_id = ? AND status IN ('SUBMITTED','TRIAGED') "
                        + "AND reporter_id = (SELECT user_id FROM community_profile WHERE username = ?)",
                Integer.class, freshMoment, f.reporterName);
        assertEquals(1, count, "数据库中该 (用户, 对象) 的未终结举报必须只有一条");
    }

    @Test
    void cannotReportOwnContent() throws Exception {
        Fixture f = buildHiddenMoment();
        String ownMoment = createMoment(f.authorToken, PREFIX + "自己的动态");

        mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", f.authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","reason":"SPAM"}
                                """.formatted(ownMoment)))
                .andExpect(status().isConflict());
    }

    @Test
    void reportingANonExistentObjectIsRejected() throws Exception {
        Fixture f = buildHiddenMoment();
        mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", f.reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"does-not-exist-0000","reason":"SPAM"}
                                """))
                .andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------
    // 5. 越权读取（IDOR）：猜 id 也读不到别人的举报/申诉
    // ---------------------------------------------------------------

    @Test
    void anotherUserCannotReadSomeoneElsesReportByGuessingTheId() throws Exception {
        Fixture f = buildHiddenMoment();
        // f.reporterToken 拥有这条举报；作者（非举报人）来猜 id。
        mockMvc.perform(get("/api/v1/me/reports/" + f.reportId).header("satoken", f.authorToken))
                .andExpect(status().isNotFound());
        // 举报人自己读得到，证明 404 不是"路径写错"。
        mockMvc.perform(get("/api/v1/me/reports/" + f.reportId).header("satoken", f.reporterToken))
                .andExpect(status().isOk());
    }

    @Test
    void anotherUserCannotReadSomeoneElsesAppealByGuessingTheId() throws Exception {
        Fixture f = buildHiddenMoment();
        String appealId = submitAppeal(f.authorToken, f.caseId, f.measureId, "作者申诉");

        // 举报人（非申诉人）猜 id → 404。
        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", f.reporterToken))
                .andExpect(status().isNotFound());
        // 申诉人自己读得到。
        mockMvc.perform(get("/api/v1/me/appeals/" + appealId).header("satoken", f.authorToken))
                .andExpect(status().isOk());
    }

    // ---------------------------------------------------------------
    // fixtures
    // ---------------------------------------------------------------

    private record Fixture(String authorToken, String authorName, String reporterToken, String reporterName,
                           String momentId, String reportId, String caseId, String measureId) {
    }

    /** 造一个"已被管理员认定违规并隐藏"的动态，附带可申诉的 measure。 */
    private Fixture buildHiddenMoment() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorName = USER_PREFIX + "owner" + (nonce % 100_000_000L);
        String reporterName = USER_PREFIX + "reporter" + (nonce % 100_000_000L);
        String authorEmail = authorName + "@example.com";
        String reporterEmail = reporterName + "@example.com";

        register(authorEmail, authorName, password);
        register(reporterEmail, reporterName, password);
        String authorToken = login(authorEmail, password);
        String reporterToken = login(reporterEmail, password);

        String momentId = createMoment(authorToken, PREFIX + "被治理动态");
        String reportId = submitReport(reporterToken, "MOMENT", momentId, "SPAM");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        String measureId = latestMeasureId(caseId);

        assertEquals("HIDDEN", momentStatus(momentId), "fixture 前置：认定违规后对象必须隐藏");
        return new Fixture(authorToken, authorName, reporterToken, reporterName,
                momentId, reportId, caseId, measureId);
    }

    // ---- HTTP helpers ----

    private void register(String email, String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String createComment(String token, String objectType, String objectId, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","body":"%s"}
                                """.formatted(objectType, objectId, body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    /**
     * 走真实发布流水线造一篇已发布文章：创建 → 写草稿 → 提交 → 管理员审核通过。
     * 与 {@code GovernanceCrossModuleVisibilityIntegrationTest.publishArticle} 同一路径。
     */
    private String publishArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("articleId").asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文内容","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(title)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk());

        // 管理员审核队列里找到该提交并批准。
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode queueBody = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode queueRows = queueBody.isArray() ? queueBody : queueBody.path("data");
        String submissionId = null;
        for (JsonNode row : queueRows) {
            if (articleId.equals(row.path("articleId").asText(null))) {
                submissionId = row.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "发布流水线：必须在审核队列中找到该文章");
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String submitReport(String token, String objectType, String objectId, String reason) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"%s"}
                                """.formatted(objectType, objectId, reason)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
    }

    private void decideCase(String caseId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    private String submitAppeal(String token, String caseId, String measureId, String detail) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"%s"}
                                """.formatted(caseId, measureId, detail)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private void decideAppeal(String appealId, String decision, String comment) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision":"%s","comment":"%s"}
                                """.formatted(decision, comment)))
                .andExpect(status().isOk());
    }

    // ---- DB probes ----

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    /**
     * 文章的<b>审核</b>状态（治理隐藏写这一列）。
     *
     * <p>不要用 `article.status`：那是生命周期状态（PUBLISHED/DRAFT），
     * 治理隐藏不会翻转它；真实的隐藏标记在 `moderation_status`
     * （V029 建的 `NORMAL/HIDDEN`，见 {@code ArticleStateSupport}）。
     */
    private String articleModerationStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT moderation_status FROM article WHERE id = ?", String.class, articleId);
    }

    /** 该对象在搜索索引里的行数（用于证明 COMMENT 永不入索引）。 */
    private int searchDocumentCount(String objectType, String objectId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type = ? AND object_id = ?",
                Integer.class, objectType, objectId);
        return n == null ? 0 : n;
    }

    private String caseIdOf(String reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private String latestMeasureId(String caseId) {
        return jdbcTemplate.queryForObject(
                "SELECT mm.id FROM moderation_measure mm "
                        + "JOIN moderation_decision md ON md.id = mm.decision_id "
                        + "WHERE md.case_id = ? ORDER BY mm.created_at DESC LIMIT 1",
                String.class, caseId);
    }

    private String appealStatus(String appealId) {
        return jdbcTemplate.queryForObject("SELECT status FROM appeal WHERE id = ?", String.class, appealId);
    }

    private String appealOutcome(String appealId) {
        return jdbcTemplate.queryForObject("SELECT outcome FROM appeal WHERE id = ?", String.class, appealId);
    }

    private Object appealDecidedAt(String appealId) {
        return jdbcTemplate.queryForObject("SELECT decided_at FROM appeal WHERE id = ?", Object.class, appealId);
    }

    private String appealDecidedBy(String appealId) {
        return jdbcTemplate.queryForObject("SELECT decided_by FROM appeal WHERE id = ?", String.class, appealId);
    }

    private int measureCount(String caseId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM moderation_measure mm "
                        + "JOIN moderation_decision md ON md.id = mm.decision_id WHERE md.case_id = ?",
                Integer.class, caseId);
        return n == null ? 0 : n;
    }
}
