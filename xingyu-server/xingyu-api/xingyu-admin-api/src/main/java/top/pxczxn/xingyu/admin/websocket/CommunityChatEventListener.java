package top.pxczxn.xingyu.admin.websocket;

import top.pxczxn.xingyu.community.event.ChatMessageSentEvent;
import top.pxczxn.xingyu.community.event.CommunityChatRealtimeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CommunityChatEventListener {

    private final CommunityChatWebSocketHandler chatWebSocketHandler;

    @EventListener
    public void onChatMessageSent(ChatMessageSentEvent event) {
        chatWebSocketHandler.broadcastMessage(event.conversationId(), event.message());
    }

    @EventListener
    public void onChatRealtimeEvent(CommunityChatRealtimeEvent event) {
        chatWebSocketHandler.broadcastPayload(event.conversationId(), event.eventType(), event.payload());
    }
}
