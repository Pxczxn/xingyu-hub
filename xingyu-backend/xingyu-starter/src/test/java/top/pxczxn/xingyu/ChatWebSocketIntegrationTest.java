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
@ActiveProfiles("dev")
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
