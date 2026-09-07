package top.pxczxn.xingyu.community.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.BlockedUserView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UserBlock;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CreatorFollowMapper;
import top.pxczxn.xingyu.community.mapper.UserBlockMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserBlockService {

    private final UserBlockMapper userBlockMapper;
    private final CommunityProfileMapper profileMapper;
    private final CreatorFollowMapper creatorFollowMapper;

    public boolean isBlockedEitherWay(String userId, String otherUserId) {
        if (userId == null || otherUserId == null || userId.equals(otherUserId)) {
            return false;
        }
        return userBlockMapper.countBlockBetween(userId, otherUserId) > 0;
    }

    public List<BlockedUserView> listBlocked(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 50;
        }
        return userBlockMapper.listByBlocker(user.getId(), limit).stream()
                .map(block -> {
                    CommunityProfile profile = profileMapper.findByUserId(block.getBlockedId());
                    return BlockedUserView.builder()
                            .userId(block.getBlockedId())
                            .username(profile == null ? block.getBlockedId() : profile.getUsername())
                            .displayName(profile == null ? null : profile.getDisplayName())
                            .blockedAt(block.getCreatedAt())
                            .build();
                })
                .toList();
    }

    @Transactional
    public void blockByUsername(CommunityUser user, String username) {
        CommunityProfile target = profileMapper.findByUsername(username);
        if (target == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (user.getId().equals(target.getUserId())) {
            throw new FieldContractException("username", "不能屏蔽自己");
        }
        if (userBlockMapper.findByPair(user.getId(), target.getUserId()) != null) {
            return;
        }
        UserBlock block = new UserBlock();
        block.setId(TokenSupport.newId());
        block.setBlockerId(user.getId());
        block.setBlockedId(target.getUserId());
        block.setCreatedAt(Instant.now());
        userBlockMapper.insert(block);
        creatorFollowMapper.deleteByFollowerAndCreator(user.getId(), target.getUserId());
        creatorFollowMapper.deleteByFollowerAndCreator(target.getUserId(), user.getId());
    }

    @Transactional
    public void unblockByUsername(CommunityUser user, String username) {
        CommunityProfile target = profileMapper.findByUsername(username);
        if (target == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        UserBlock block = userBlockMapper.findByPair(user.getId(), target.getUserId());
        if (block != null) {
            userBlockMapper.deleteById(block.getId());
        }
    }
}
