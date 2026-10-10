package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Messaging Correctness Recovery 的集成验证（2026-10-06）。
 *
 * <p><b>这是 fixture 级验证</b>：账号由测试现场注册，附件现场上传。它证明代码 + 迁移 +
 * 真实 MySQL 这条链路成立，不代表线上真实多人数据。
 *
 * <p>钉住的每一条都是审计里实测过的缺陷：
 * <ul>
 *   <li>未读不再把自己发的消息算进去；</li>
 *   <li>重连对账用的 after-sequence 方向可用，且不重不漏；</li>
 *   <li>消息带结构化 sender，且 sender 改名后历史消息跟着变；</li>
 *   <li>附件下载必须校验 conversation membership，且旧的静态路径被拒绝；</li>
 *   <li>停用账号既不能被发起私信，已有会话也不能继续写入；</li>
 *   <li>拉黑阻止未来联系但历史仍可读（定档后的语义）。</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MessagingCorrectnessIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long nonce;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        nonce = System.nanoTime();
    }

    // ------------------------------------------------------------------ 未读语义

    @Test
    void ownMessagesAreNeverCountedAsOwnUnread() throws Exception {
        Account a = register("mua");
        Account b = register("mub");
        String conversationId = openDirect(a, b.username);

        // A 自己发 5 条
        for (int index = 0; index < 5; index++) {
            send(a.token, conversationId, "A 的第 " + index + " 条");
        }
        // B 发 3 条
        for (int index = 0; index < 3; index++) {
            send(b.token, conversationId, "B 的第 " + index + " 条");
        }

        // A 视角：只有 B 的 3 条是未读
        assertThat(unreadOf(a.token, conversationId)).isEqualTo(3);
        // B 视角：只有 A 的 5 条是未读
        assertThat(unreadOf(b.token, conversationId)).isEqualTo(5);

        // 读完之后归零，且数据库里的游标真的动了
        mockMvc.perform(patch("/api/v1/messages/" + conversationId + "/read").header("satoken", a.token))
                .andExpect(status().isNoContent());
        assertThat(unreadOf(a.token, conversationId)).isZero();
        Long stored = jdbcTemplate.queryForObject(
                "SELECT last_read_sequence FROM conversation_member WHERE conversation_id = ? AND user_id = ?",
                Long.class,
                conversationId,
                a.userId);
        assertThat(stored).isEqualTo(8L);
    }

    @Test
    void mailboxHeaderTotalExcludesOwnMessages() throws Exception {
        Account a = register("mta");
        Account b = register("mtb");
        String conversationId = openDirect(a, b.username);
        send(a.token, conversationId, "我自己的");
        send(b.token, conversationId, "你发的");

        mockMvc.perform(get("/api/v1/messages").header("satoken", a.token))
                .andExpect(status().isOk())
                // A 只欠 B 那一条
                .andExpect(jsonPath("$[0].unreadCount").value(1));
    }

    // ------------------------------------------------------------------ 重连对账

    @Test
    void afterSequenceReturnsExactlyWhatCameAfterTheCursor() throws Exception {
        Account a = register("maa");
        Account b = register("mab");
        String conversationId = openDirect(a, b.username);

        for (int index = 1; index <= 6; index++) {
            send(b.token, conversationId, "第 " + index + " 条");
        }

        // 从 3 之后开始：4,5,6，升序
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/after")
                        .param("afterSequence", "3")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasMore").value(false))
                .andExpect(jsonPath("$.messages.length()").value(3))
                .andExpect(jsonPath("$.messages[0].sequenceNumber").value(4))
                .andExpect(jsonPath("$.messages[0].body").value("第 4 条"))
                .andExpect(jsonPath("$.messages[2].sequenceNumber").value(6));

        // 不传游标 = 从最早开始（升序）。客户端永远传本地已知最大序号，所以这个分支
        // 只是把「没有游标」定义清楚，而不是一条会悄悄用错的路。
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/after")
                        .param("limit", "2")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasMore").value(true))
                .andExpect(jsonPath("$.messages[0].sequenceNumber").value(1))
                .andExpect(jsonPath("$.messages[1].sequenceNumber").value(2));
    }

    @Test
    void afterSequenceIsForbiddenForNonMembers() throws Exception {
        Account a = register("mna");
        Account b = register("mnb");
        Account outsider = register("mnc");
        String conversationId = openDirect(a, b.username);

        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/after")
                        .header("satoken", outsider.token))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ sender 身份

    @Test
    void messagesCarryAStructuredSenderResolvedFromTheCurrentProfile() throws Exception {
        Account a = register("msa");
        Account b = register("msb");
        String conversationId = openDirect(a, b.username);
        send(b.token, conversationId, "带身份的消息");

        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sender.userId").value(b.userId))
                .andExpect(jsonPath("$.items[0].sender.username").value(b.username))
                // senderId 保留（兼容既有消费者），但不再是唯一的身份线索
                .andExpect(jsonPath("$.items[0].senderId").value(b.userId));

        // 改名之后：同一条历史消息的 sender 指向新身份
        String renamed = b.username + "x";
        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", b.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + renamed + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sender.userId").value(b.userId))
                .andExpect(jsonPath("$.items[0].sender.username").value(renamed));
    }

    // ------------------------------------------------------------------ 附件权限

    @Test
    void onlyConversationMembersMayDownloadAnAttachment() throws Exception {
        Account a = register("maa2");
        Account b = register("mab2");
        Account outsider = register("mao2");
        String conversationId = openDirect(a, b.username);

        long fileId = uploadPng(a.token);
        MvcResult sent = mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", a.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"IMAGE","attachmentUrl":"/api/v1/admin/files/community/messages/x.png",\
                                "attachmentName":"x.png","attachmentFileId":"%d"}
                                """.formatted(fileId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachmentFileId").value(fileId))
                .andReturn();
        String messageId = json(sent).path("id").asText();

        // 成员可下载
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment")
                        .header("satoken", b.token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment")
                        .header("satoken", a.token))
                .andExpect(status().isOk());

        // 非成员 404 —— 不泄漏附件是否存在
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment")
                        .header("satoken", outsider.token))
                .andExpect(status().isNotFound());
        // 无会话 401
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theUnauthenticatedStaticPathNoLongerServesMessageAttachments() throws Exception {
        Account a = register("msa2");
        Account b = register("msb2");
        String conversationId = openDirect(a, b.username);
        // 一次上传，两个断言都从它身上取（两次上传会得到两个不同的 fileId）。
        MvcResult upload = mockMvc.perform(multipart("/api/v1/messages/upload")
                        .file(new MockMultipartFile("file", "x.png", "image/png", png()))
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andReturn();
        String url = json(upload).path("url").asText();
        assertThat(url).contains("/api/v1/admin/files/community/messages/");
        assertThat(json(upload).path("fileId").asLong()).isPositive();

        // 这条路径以前不带任何 token 就能取到文件（实测 200），现在必须被拒绝
        mockMvc.perform(get(url)).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ 停用账号

    @Test
    void suspendedAccountsCannotBeMessagedAtAll() throws Exception {
        Account a = register("mua2");
        Account b = register("mub2");
        String conversationId = openDirect(a, b.username);
        send(b.token, conversationId, "停用前");

        jdbcTemplate.update("UPDATE community_user SET status = 'SUSPENDED' WHERE id = ?", b.userId);

        // 已有会话也不能继续写入（此前实测能写进去，而对方登不进来）
        mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", a.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"停用后还能发吗\"}"))
                .andExpect(status().isForbidden());

        // 也不能新建/取到与他的私信
        mockMvc.perform(post("/api/v1/messages/direct/" + b.username).header("satoken", a.token))
                .andExpect(status().isForbidden());

        // 历史仍然可读 —— 停用不是抹除
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages").header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("停用前"));
    }

    // ------------------------------------------------------------------ Block 语义定档

    @Test
    void blockStopsFutureContactButKeepsHistoryReadable() throws Exception {
        Account a = register("mba");
        Account b = register("mbb");
        String conversationId = openDirect(a, b.username);
        send(b.token, conversationId, "拉黑之前");

        mockMvc.perform(post("/api/v1/me/blocks/" + b.username).header("satoken", a.token))
                .andExpect(status().isNoContent());

        // 双方都不能继续发送
        mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", a.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"还能发吗\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", b.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"我还能发吗\"}"))
                .andExpect(status().isConflict());
        // 不能重新建立 direct
        mockMvc.perform(post("/api/v1/messages/direct/" + b.username).header("satoken", a.token))
                .andExpect(status().isConflict());

        // 定档：历史仍然可读，双方都读得到，且不删除
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages").header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("拉黑之前"));
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages").header("satoken", b.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("拉黑之前"));
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM chat_message WHERE conversation_id = ?", Integer.class, conversationId);
        assertThat(rows).isEqualTo(1);
    }

    // ------------------------------------------------------------------ 搜索落点

    @Test
    void aroundSequenceReturnsAWindowCentredOnTheTarget() throws Exception {
        Account a = register("mar");
        Account b = register("mbr");
        String conversationId = openDirect(a, b.username);
        for (int index = 1; index <= 12; index++) {
            send(b.token, conversationId, "消息 " + index);
        }

        // 目标是第 8 条 —— 远早于首屏（最近 100 条），必须一次请求就能圈出来，
        // 而不是「从最新一页一路往前翻」。
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/around")
                        .param("sequence", "8")
                        .param("limit", "5")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.sequence").value(8))
                // limit 是总数：目标之前 3 条 + 目标 + 之后 1 条（前方多一条更有助理解）
                .andExpect(jsonPath("$.messages.length()").value(5))
                .andExpect(jsonPath("$.messages[0].sequenceNumber").value(5))
                .andExpect(jsonPath("$.messages[3].sequenceNumber").value(8))
                .andExpect(jsonPath("$.messages[4].sequenceNumber").value(9));

        // 目标靠近开头时窗口自然更短，但仍然必须包含目标本身。
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/around")
                        .param("sequence", "2")
                        .param("limit", "5")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.messages[0].sequenceNumber").value(1))
                .andExpect(jsonPath("$.messages[1].sequenceNumber").value(2));

        // 目标不存在时必须说清楚，而不是给一段无关的历史。
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/around")
                        .param("sequence", "9999")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(false))
                .andExpect(jsonPath("$.messages.length()").value(0));
    }

    @Test
    void aroundSequenceIsForbiddenForNonMembers() throws Exception {
        Account a = register("mcs");
        Account b = register("mcs2");
        Account outsider = register("mcs3");
        String conversationId = openDirect(a, b.username);
        send(b.token, conversationId, "只有成员能定位");

        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/around")
                        .param("sequence", "1")
                        .header("satoken", outsider.token))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ 搜索语义

    @Test
    void searchHitsCarrySenderAndCounterpartIdentity() throws Exception {
        Account a = register("msr");
        Account b = register("msb2");
        String conversationId = openDirect(a, b.username);
        send(b.token, conversationId, "独特关键词甲乙丙");

        mockMvc.perform(get("/api/v1/messages/search")
                        .param("q", "独特关键词")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].body").value("独特关键词甲乙丙"))
                .andExpect(jsonPath("$[0].sequenceNumber").value(1))
                // 之前这两样都没有：结果行既不知道谁说的，也不知道来自哪个会话。
                .andExpect(jsonPath("$[0].sender.userId").value(b.userId))
                .andExpect(jsonPath("$[0].sender.username").value(b.username))
                .andExpect(jsonPath("$[0].counterpartDisplayName").value(b.username));
    }

    // ------------------------------------------------------------------ 撤回窗口

    @Test
    void messagesExposeARecallDeadlineFromTheServerWindow() throws Exception {
        Account a = register("mrd");
        Account b = register("mrd2");
        String conversationId = openDirect(a, b.username);
        MvcResult sent = send(a.token, conversationId, "两分钟内可撤回");

        String recallUntil = json(sent).path("recallUntil").asText(null);
        assertThat(recallUntil).as("撤回截止时刻必须由服务端给出，客户端不复制窗口常量").isNotNull();

        // 撤回之后这个字段必须消失 —— 墓碑没有可撤回的东西。
        mockMvc.perform(post("/api/v1/messages/" + conversationId + "/messages/"
                        + json(sent).path("id").asText() + "/recall")
                        .header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recalledAt").isNotEmpty())
                .andExpect(jsonPath("$.recallUntil").doesNotExist());
    }

    // ------------------------------------------------------------------ 收藏附件

    @Test
    void savedMessagesExposeTheAttachmentFileIdSoDownloadsStayAuthorized() throws Exception {
        Account a = register("msa3");
        Account b = register("msb3");
        Account outsider = register("mso3");
        String conversationId = openDirect(a, b.username);

        long fileId = uploadPng(a.token);
        MvcResult sent = mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", a.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"IMAGE","attachmentUrl":"/api/v1/admin/files/community/messages/x.png",\
                                "attachmentName":"x.png","attachmentFileId":"%d"}
                                """.formatted(fileId)))
                .andExpect(status().isOk())
                .andReturn();
        String messageId = json(sent).path("id").asText();

        mockMvc.perform(post("/api/v1/me/saved-messages")
                        .header("satoken", a.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messageId\":\"%s\"}".formatted(messageId)))
                .andExpect(status().isOk());

        // 收藏视图必须带上 file id，页面才能走受鉴权下载；只有 url 的话整页 403。
        mockMvc.perform(get("/api/v1/me/saved-messages").header("satoken", a.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].attachmentFileId").value(fileId))
                .andExpect(jsonPath("$[0].messageId").value(messageId))
                .andExpect(jsonPath("$[0].conversationId").value(conversationId));

        // 边界不变：成员可下载，非成员 404，旧静态路径 403。
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment")
                        .header("satoken", a.token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/messages/" + conversationId + "/messages/" + messageId + "/attachment")
                        .header("satoken", outsider.token))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/admin/files/community/messages/x.png"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ helpers

    private record Account(String username, String userId, String token) {
    }

    private Account register(String prefix) throws Exception {
        String suffix = Long.toString(nonce, 36) + Math.abs(prefix.hashCode() % 997);
        String raw = (prefix + suffix).toLowerCase(java.util.Locale.ROOT);
        String username = raw.length() > 32 ? raw.substring(0, 32) : raw;
        String email = username + "@example.com";
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk())
                .andReturn();
        String userId = json(registered).path("userId").asText();
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"Test1234!@#ab","rememberMe":false}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return new Account(username, userId, login.getResponse().getHeader("satoken"));
    }

    private String openDirect(Account from, String otherUsername) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/messages/direct/" + otherUsername)
                        .header("satoken", from.token))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).path("id").asText();
    }

    private MvcResult send(String token, String conversationId, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private long unreadOf(String token, String conversationId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/messages/direct/" + conversationId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).path("unreadCount").asLong();
    }

    private long uploadPng(String token) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/v1/messages/upload")
                        .file(new MockMultipartFile("file", "probe.png", "image/png", png()))
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).path("fileId").asLong();
    }

    /** A real (if tiny) PNG — the static-path test needs a stored file, not a fake name. */
    private static byte[] png() {
        return java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unused")
    private List<String> unusedGuard() {
        return List.of();
    }
}
