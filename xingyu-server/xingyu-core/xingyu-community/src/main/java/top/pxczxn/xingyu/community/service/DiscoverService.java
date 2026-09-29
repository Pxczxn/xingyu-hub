package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.DiscoverNavTabView;
import top.pxczxn.xingyu.community.dto.DiscoverNavView;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DiscoverService {

    public DiscoverNavView nav() {
        return DiscoverNavView.builder()
                .typeTabs(List.of(
                        tab("all", "全部", true),
                        tab("article", "文章", false),
                        tab("series", "系列", false),
                        tab("creator", "创作者", false),
                        tab("topic", "话题", false),
                        tab("moment", "动态", false)))
                .sortTabs(List.of(
                        tab("latest", "最新", false),
                        tab("featured", "精选", true),
                        tab("hot", "近期热门", false),
                        tab("interest", "兴趣相关", false)))
                .build();
    }

    private DiscoverNavTabView tab(String key, String label, boolean defaultSelected) {
        return DiscoverNavTabView.builder()
                .key(key)
                .label(label)
                .defaultSelected(defaultSelected)
                .build();
    }
}
