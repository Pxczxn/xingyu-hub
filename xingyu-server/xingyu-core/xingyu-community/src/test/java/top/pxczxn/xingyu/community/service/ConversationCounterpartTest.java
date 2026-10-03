package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.Conversation;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.mapper.ChatMessageMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import top.pxczxn.xingyu.community.mapper.GroupJoinRequestMapper;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Resolution of a DIRECT conversation's counterpart name.
 *
 * Added 2026-10-03. The three backend changes in this batch initially shipped
 * behind nothing but `mvn compile`, and the integration tests need a live MySQL
 * (`localhost:3306/xingyu_hub_test`) that this environment does not have. So the
 * resolution rules are verified here instead, with mocked mappers — the logic
 * touches no database directly, only the mappers do.
 *
 * What is worth pinning: that the CURRENT user is excluded (getting your own name
 * back would be worse than no name), that a blank display name falls through to
 * the username rather than rendering as empty, and that every missing-input path
 * returns null instead of throwing. The client treats null as "unknown" and falls
 * back; it cannot recover from an exception.
 */
class ConversationCounterpartTest {

    private ConversationMapper conversationMapper;
    private ConversationMemberMapper memberMapper;
    private ChatMessageMapper messageMapper;
    private CommunityUserMapper userMapper;
    private CommunityProfileMapper profileMapper;
    private GroupJoinRequestMapper joinRequestMapper;
    private UserBlockService userBlockService;
    private CommunityProperties communityProperties;
    private ApplicationEventPublisher eventPublisher;

    private ConversationService service;

    @BeforeEach
    void setUp() {
        conversationMapper = mock(ConversationMapper.class);
        memberMapper = mock(ConversationMemberMapper.class);
        messageMapper = mock(ChatMessageMapper.class);
        userMapper = mock(CommunityUserMapper.class);
        profileMapper = mock(CommunityProfileMapper.class);
        joinRequestMapper = mock(GroupJoinRequestMapper.class);
        userBlockService = mock(UserBlockService.class);
        communityProperties = mock(CommunityProperties.class);
        eventPublisher = mock(ApplicationEventPublisher.class);

        service = new ConversationService(
                conversationMapper,
                memberMapper,
                messageMapper,
                userMapper,
                profileMapper,
                joinRequestMapper,
                userBlockService,
                communityProperties,
                eventPublisher);
    }

    private static Conversation conversation(String type) {
        Conversation conversation = new Conversation();
        conversation.setId("c-1");
        conversation.setType(type);
        return conversation;
    }

    private static ConversationMember member(String userId) {
        ConversationMember member = new ConversationMember();
        member.setConversationId("c-1");
        member.setUserId(userId);
        return member;
    }

    private static CommunityProfile profile(String displayName, String username) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("u-other");
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }

    @Test
    @DisplayName("returns the counterpart's display name")
    void returnsDisplayName() {
        when(memberMapper.listByConversationId("c-1"))
                .thenReturn(List.of(member("u-me"), member("u-other")));
        when(profileMapper.findByUserId("u-other")).thenReturn(profile("爱丽丝", "alice"));

        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me"))
                .isEqualTo("爱丽丝");
    }

    @Test
    @DisplayName("never returns the current user's own name")
    void excludesSelf() {
        // If this regressed, a direct conversation would be labelled with your own
        // name — worse than the generic 「私信」 it replaced.
        when(memberMapper.listByConversationId("c-1"))
                .thenReturn(List.of(member("u-me"), member("u-other")));
        when(profileMapper.findByUserId("u-other")).thenReturn(profile("爱丽丝", "alice"));
        when(profileMapper.findByUserId("u-me")).thenReturn(profile("我自己", "me"));

        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me"))
                .isNotEqualTo("我自己");
    }

    @Test
    @DisplayName("falls back to the username when the display name is blank")
    void blankDisplayNameFallsBackToUsername() {
        when(memberMapper.listByConversationId("c-1")).thenReturn(List.of(member("u-other")));
        when(profileMapper.findByUserId("u-other")).thenReturn(profile("   ", "alice"));

        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me"))
                .isEqualTo("alice");
    }

    @Test
    @DisplayName("GROUP conversations get no counterpart — their title is the group name")
    void groupHasNoCounterpart() {
        assertThat(service.resolveCounterpartDisplayName(conversation("GROUP"), "u-me")).isNull();
    }

    @Test
    @DisplayName("a missing profile yields null, never the raw user id")
    void missingProfileIsNull() {
        when(memberMapper.listByConversationId("c-1")).thenReturn(List.of(member("u-other")));
        when(profileMapper.findByUserId("u-other")).thenReturn(null);

        // Null, not "u-other": an opaque id tells the reader nothing, and the
        // client falls back to its own label. It also cannot recover from an
        // exception, so every missing-input path must return rather than throw.
        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me"))
                .isNull();
    }

    @Test
    @DisplayName("a conversation with no other member yields null")
    void noOtherMemberIsNull() {
        when(memberMapper.listByConversationId("c-1")).thenReturn(List.of(member("u-me")));

        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me")).isNull();
    }

    @Test
    @DisplayName("an empty member list yields null")
    void emptyMembersIsNull() {
        when(memberMapper.listByConversationId(anyString())).thenReturn(List.of());

        assertThat(service.resolveCounterpartDisplayName(conversation("DIRECT"), "u-me")).isNull();
    }
}
