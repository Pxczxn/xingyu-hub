package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final SearchDocumentMapper searchDocumentMapper;

    public List<SearchResultView> search(String query, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<SearchDocument> docs;
        if (query == null || query.isBlank()) {
            docs = searchDocumentMapper.listActive(limit);
        } else {
            docs = searchDocumentMapper.searchActive(query.trim(), limit);
        }
        return docs.stream().map(this::toView).toList();
    }

    private SearchResultView toView(SearchDocument doc) {
        return SearchResultView.builder()
                .objectType(doc.getObjectType())
                .objectId(doc.getObjectId())
                .title(doc.getTitle())
                .summary(doc.getSummary())
                .build();
    }
}
