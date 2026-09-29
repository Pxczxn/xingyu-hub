package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.entity.CommunityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DataExportService {

    private final CommunityProfileService profileService;
    private final CollectionService collectionService;
    private final ArticleService articleService;
    private final SocialService socialService;
    private final ReadingService readingService;

    public Map<String, Object> export(CommunityUser user) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("exportedAt", Instant.now().toString());
        payload.put("profile", profileService.getProfile(user));
        payload.put("articles", articleService.listForOwner(user));
        payload.put("collections", collectionService.listMine(user));
        payload.put("comments", socialService.listMyComments(user, 200));
        payload.put("likes", socialService.listMyLikes(user, 200));
        payload.put("bookshelf", readingService.bookshelf(user, 200, null).getItems());
        payload.put("readingHistory", readingService.readingHistory(user, 200, null).getItems());
        return payload;
    }
}
