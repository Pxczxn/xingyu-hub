package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatWebSocketIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void directMessagePushAndClientMessageIdempotency() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";

        String userAId = registerUser("wsa" + nonce + "@example.com", "wsa" + (nonce % 1_000_000_000L), password);
        String userBId = registerUser("wsb" + nonce + "@example.com", "wsb" + (nonce % 1_000_000_000L), password);

        String tokenA = login("wsa" + nonce + "@example.com", password);
        String tokenB = login("wsb" + nonce + "@example.com", password);

        MvcResult openDirect = mockMvc.perform(post("/api/v1/messages/direct/" + userBId)
                        .header("satoken", tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();

        String conversationId = objectMapper.readTree(openDirect.getResponse().getContentAsString()).path("id").asText();

        List<JsonNode> received = new ArrayList<>();
        CountDownLatch messageLatch = new CountDownLatch(1);
        StandardWebSocketClient client = new StandardWebSocketClient();
        String wsUrl = "ws://localhost:" + port + "/ws/community/chat?token=" + tokenB;

        WebSocketSession wsSession = client.execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
                JsonNode payload = objectMapper.readTree(message.getPayload());
                received.add(payload);
                if ("message".equals(payload.path("type").asText())) {
                    messageLatch.countDown();
                }
            }
        }, wsUrl).get(10, TimeUnit.SECONDS);

        awaitConnected(received);

        mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"WebSocket 联调消息","clientMessageId":"client-msg-%d"}
                                """.formatted(nonce)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("WebSocket 联调消息"));

        assertTrue(messageLatch.await(10, TimeUnit.SECONDS), "接收方应通过 WebSocket 收到消息推送");
        JsonNode pushed = received.stream()
                .filter(node -> "message".equals(node.path("type").asText()))
                .findFirst()
                .orElseThrow();
        assertEquals(conversationId, pushed.path("conversationId").asText());
        assertEquals("WebSocket 联调消息", pushed.path("message").path("body").asText());

        MvcResult duplicate = mockMvc.perform(post("/api/v1/messages/direct/" + conversationId + "/messages")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"WebSocket 联调消息","clientMessageId":"client-msg-%d"}
                                """.formatted(nonce)))
                .andExpect(status().isOk())
                .andReturn();

        String firstMessageId = pushed.path("message").path("id").asText();
        String duplicateMessageId = objectMapper.readTree(duplicate.getResponse().getContentAsString()).path("id").asText();
        assertEquals(firstMessageId, duplicateMessageId);

        CompletableFuture<JsonNode> pongFuture = new CompletableFuture<>();
        wsSession.sendMessage(new TextMessage("{\"type\":\"ping\"}"));
        for (int attempt = 0; attempt < 20 && !pongFuture.isDone(); attempt++) {
            Thread.sleep(100);
            received.stream()
                    .filter(node -> "pong".equals(node.path("type").asText()))
                    .findFirst()
                    .ifPresent(pongFuture::complete);
        }
        assertEquals("pong", pongFuture.get(5, TimeUnit.SECONDS).path("type").asText());

        wsSession.close();
    }

    /**
     * 回归：一次<b>并发</b>发送不能把已写库成功的请求变成 500。
     *
     * <p>实测过（2026-10-06）：对方连发 20 条时，服务端抛
     * {@code IllegalStateException: The remote endpoint was in state [TEXT_PARTIAL_WRITING]}，
     * 异常从事件监听器一路冒泡回 {@code sendMessage}，发送方直接收到 500 —— 而那一行其实
     * 已经写进库了。根因是 Tomcat 的发送端点不是并发安全的：两条广播同时写同一条连接就会
     * 撞状态机。修复是每条连接套 {@code ConcurrentWebSocketSessionDecorator}（写串行化 + 缓冲），
     * 并且让推送失败绝不影响发送请求本身。
     */
    @Test
    void concurrentSendsNeverFailTheRequestThatAlreadyCommitted() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";

        String userAId = registerUser("wsa" + nonce + "@example.com", "wsa" + (nonce % 1_000_000_000L), password);
        String userBId = registerUser("wsb" + nonce + "@example.com", "wsb" + (nonce % 1_000_000_000L), password);
        String tokenA = login("wsa" + nonce + "@example.com", password);
        String tokenB = login("wsb" + nonce + "@example.com", password);

        MvcResult openDirect = mockMvc.perform(post("/api/v1/messages/direct/" + userBId)
                        .header("satoken", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        String conversationId = objectMapper.readTree(openDirect.getResponse().getContentAsString()).path("id").asText();

        // 接收方在线 —— 竞态只有在有连接可写的时候才会发生。
        StandardWebSocketClient client = new StandardWebSocketClient();
        String wsUrl = "ws://localhost:" + port + "/ws/community/chat?token=" + tokenB;
        WebSocketSession wsSession = client.execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                // frames are not what this test is about
            }
        }, wsUrl).get(10, TimeUnit.SECONDS);
        Thread.sleep(300);

        // 真实 HTTP 而不是 MockMvc：MockMvc 本身不是线程安全的，并发 perform 会自己炸，
        // 那样测的就不是被测代码了。
        int burst = 12;
        java.net.http.HttpClient http = java.net.http.HttpClient.newHttpClient();
        List<java.util.concurrent.CompletableFuture<Integer>> futures = new ArrayList<>();
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(6);
        try {
            for (int index = 0; index < burst; index++) {
                int current = index;
                futures.add(java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                    java.net.http.HttpRequest request = java.net.http.HttpRequest
                            .newBuilder(java.net.URI.create("http://localhost:" + port
                                    + "/api/v1/messages/direct/" + conversationId + "/messages"))
                            .header("Content-Type", "application/json")
                            .header("satoken", tokenA)
                            .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                    "{\"body\":\"并发消息 " + current + "\"}"))
                            .build();
                    try {
                        return http.send(request, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode();
                    } catch (Exception ex) {
                        return 500;
                    }
                }, pool));
            }
            for (java.util.concurrent.CompletableFuture<Integer> future : futures) {
                assertEquals(200, future.get(30, TimeUnit.SECONDS));
            }
        } finally {
            pool.shutdownNow();
            wsSession.close();
        }

        // 并且每一条都真的落库了（没有静默丢失）
        MvcResult page = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/messages/" + conversationId + "/messages?limit=50")
                        .header("satoken", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(
                burst,
                objectMapper.readTree(page.getResponse().getContentAsString()).path("items").size());
    }

    private String registerUser(String email, String username, String password) throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(registerResult.getResponse().getContentAsString()).path("userId").asText();
    }

    private String login(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return loginResult.getResponse().getHeader("satoken");
    }

    private void awaitConnected(List<JsonNode> received) throws InterruptedException {
        for (int attempt = 0; attempt < 50; attempt++) {
            boolean connected = received.stream()
                    .anyMatch(node -> "connected".equals(node.path("type").asText()));
            if (connected) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("WebSocket 未收到 connected 帧");
    }
}
