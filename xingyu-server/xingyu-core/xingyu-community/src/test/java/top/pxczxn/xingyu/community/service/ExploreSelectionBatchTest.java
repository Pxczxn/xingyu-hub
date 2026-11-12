package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ExploreDomain;
import top.pxczxn.xingyu.community.entity.UserExploreDomain;
import top.pxczxn.xingyu.community.mapper.ExploreDomainMapper;
import top.pxczxn.xingyu.community.mapper.UserExploreDomainMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExploreSelectionBatchTest {

    private final ExploreDomainMapper domains = mock(ExploreDomainMapper.class);
    private final UserExploreDomainMapper links = mock(UserExploreDomainMapper.class);
    private final ExplorationService service = new ExplorationService(
            domains, links, null, null, null, null, null);

    @Test
    void savingSelectionLoadsActiveDomainsOnceAndKeepsOrder() {
        when(domains.listActiveByIds(List.of("tech", "missing", "mine", "art"))).thenReturn(List.of(
                domain("art", "SYSTEM"),
                domain("mine", "PERSONAL"),
                domain("tech", "SYSTEM")));
        when(domains.listPersonalByUser("user-1234")).thenReturn(List.of());
        when(domains.listByUserExploration("user-1234")).thenReturn(List.of());

        service.updateUserExploration(user("user-1234"), Map.of(
                "domainIds", List.of("tech", "missing", "mine", "art")));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserExploreDomain>> saved = ArgumentCaptor.forClass(List.class);
        verify(links).deleteByUserId("user-1234");
        verify(links).insertAll(saved.capture());
        assertThat(saved.getValue()).extracting(UserExploreDomain::getDomainId).containsExactly("tech", "art");
        assertThat(saved.getValue()).extracting(UserExploreDomain::getSortOrder).containsExactly(0, 1);
        verify(links, never()).insert(any());
        verify(domains, never()).insert(any());
        verify(domains, never()).insertAll(any());
        verify(domains, never()).findActiveById(any());
        verify(domains, never()).updateById(any());
        verify(domains, never()).archiveAllPersonalByUser(any());
        verify(domains, never()).archivePersonalExceptNames(any(), any());
    }

    @Test
    void emptySelectionDoesNotQueryDomains() {
        when(domains.listPersonalByUser("user-1234")).thenReturn(List.of());
        when(domains.listByUserExploration("user-1234")).thenReturn(List.of());

        service.updateUserExploration(user("user-1234"), Map.of());

        verify(domains, never()).listActiveByIds(any());
        verify(domains, never()).findActiveById(any());
        verify(links, never()).insert(any());
        verify(links, never()).insertAll(any());
        verify(domains, never()).insert(any());
        verify(domains, never()).insertAll(any());
        verify(domains, never()).updateById(any());
        verify(domains, never()).archiveAllPersonalByUser(any());
        verify(domains, never()).archivePersonalExceptNames(any(), any());
    }

    @Test
    void droppedPersonalLabelsArchiveOnceAndKeptLabelsAreNotReinserted() {
        when(domains.listActiveByIds(any())).thenReturn(List.of());
        when(domains.listPersonalByUser("user-1234")).thenReturn(List.of(
                domain("old", "PERSONAL"),
                domain("art", "PERSONAL")));
        when(domains.listByUserExploration("user-1234")).thenReturn(List.of());

        service.updateUserExploration(user("user-1234"), Map.of(
                "customLabels", List.of("art", "fresh")));

        verify(domains).archivePersonalExceptNames("user-1234", List.of("art", "fresh"));
        verify(domains, never()).archiveAllPersonalByUser(any());
        verify(domains, never()).updateById(any());
        verify(domains, never()).insert(any());
        verify(links, never()).insert(any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ExploreDomain>> created = ArgumentCaptor.forClass(List.class);
        verify(domains).insertAll(created.capture());
        assertThat(created.getValue()).extracting(ExploreDomain::getName).containsExactly("fresh");
        assertThat(created.getValue()).extracting(ExploreDomain::getDomainType).containsExactly("PERSONAL");
        verify(links).insertAll(any());
    }

    @Test
    void clearingPersonalLabelsArchivesAllActiveOnesOnce() {
        when(domains.listPersonalByUser("user-1234")).thenReturn(List.of(
                domain("old", "PERSONAL"),
                domain("art", "PERSONAL")));
        when(domains.listByUserExploration("user-1234")).thenReturn(List.of());

        service.updateUserExploration(user("user-1234"), Map.of());

        verify(domains).archiveAllPersonalByUser("user-1234");
        verify(domains, never()).archivePersonalExceptNames(any(), any());
        verify(domains, never()).updateById(any());
        verify(domains, never()).insert(any());
        verify(domains, never()).insertAll(any());
        verify(links, never()).insert(any());
        verify(links, never()).insertAll(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static ExploreDomain domain(String id, String type) {
        ExploreDomain domain = new ExploreDomain();
        domain.setId(id);
        domain.setDomainType(type);
        domain.setStatus("ACTIVE");
        domain.setName(id);
        domain.setSlug(id);
        return domain;
    }
}
