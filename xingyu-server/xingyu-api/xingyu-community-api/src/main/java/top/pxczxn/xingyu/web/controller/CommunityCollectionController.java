package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.dto.CollectionView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CollectionService;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/collections")
@RequiredArgsConstructor
public class CommunityCollectionController {

    private final CollectionService collectionService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping("/{collectionId}")
    public CollectionView getCollection(
            @PathVariable String collectionId,
            @RequestHeader(value = "satoken", required = false) String token) {
        return collectionService.getCollection(collectionId, resolveViewer(token));
    }

    private CommunityUser resolveViewer(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            CommunitySession session = accountService.requireActiveSession(token);
            return userMapper.selectById(session.getUserId());
        } catch (ContractException ex) {
            return null;
        }
    }
}
