package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.ExploreDomain;
import top.pxczxn.xingyu.community.mapper.ExploreDomainMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExploreDomainTreeBatchTest {

    private final ExploreDomainMapper domains = mock(ExploreDomainMapper.class);
    private final ExplorationService service = new ExplorationService(
            domains, null, null, null, null, null, null);

    @Test
    void officialMapLoadsChildrenOnceAndKeepsOrder() {
        when(domains.listRootSystemDomains()).thenReturn(List.of(
                domain("tech", null, "技术"),
                domain("art", null, "艺术")));
        when(domains.listSystemChildrenByParentIds(List.of("tech", "art"))).thenReturn(List.of(
                domain("painting", "art", "绘画"),
                domain("java", "tech", "Java"),
                domain("python", "tech", "Python")));

        var map = service.listOfficialMap();

        assertThat(map).extracting("id").containsExactly("tech", "art");
        assertThat(map.get(0).getChildren()).extracting("id").containsExactly("java", "python");
        assertThat(map.get(1).getChildren()).extracting("name").containsExactly("绘画");
        verify(domains, never()).listChildren(any());
    }

    @Test
    void selectedDomainsExpandChildrenOnceAndEmptyListsSkipTheQuery() {
        when(domains.listByUserExploration("me")).thenReturn(List.of(
                domain("tech", null, "技术"),
                domain("art", null, "艺术")));
        when(domains.listActiveChildrenByParentIds(List.of("tech", "art"))).thenReturn(List.of(
                child("python", "tech"),
                child("painting", "art")));

        assertThat(service.selectedDomainIds("me"))
                .containsExactly("tech", "python", "art", "painting");

        when(domains.listRootSystemDomains()).thenReturn(List.of());
        when(domains.listByUserExploration("quiet")).thenReturn(List.of());
        assertThat(service.listOfficialMap()).isEmpty();
        assertThat(service.selectedDomainIds("quiet")).isEmpty();

        verify(domains, never()).listChildIds(any());
        verify(domains, never()).listSystemChildrenByParentIds(List.of());
        verify(domains, never()).listActiveChildrenByParentIds(List.of());
    }

    private static ExploreDomain domain(String id, String parentId, String name) {
        ExploreDomain domain = new ExploreDomain();
        domain.setId(id);
        domain.setParentId(parentId);
        domain.setName(name);
        domain.setSlug(id);
        domain.setDomainType("SYSTEM");
        return domain;
    }

    private static ExploreDomain child(String id, String parentId) {
        ExploreDomain domain = new ExploreDomain();
        domain.setId(id);
        domain.setParentId(parentId);
        return domain;
    }
}
