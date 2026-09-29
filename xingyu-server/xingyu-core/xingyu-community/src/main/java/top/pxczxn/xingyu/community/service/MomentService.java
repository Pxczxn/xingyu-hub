package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MomentService {

    private final MomentMapper momentMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final CommunityProperties communityProperties;

    public List<MomentView> listPublished(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return momentMapper.listPublished(limit).stream()
                .map(this::toView)
                .toList();
    }

    public List<MomentView> listMine(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return momentMapper.listByAuthorId(user.getId(), limit).stream()
                .map(this::toView)
                .toList();
    }

    public MomentView getById(String momentId) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !"PUBLISHED".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(moment);
    }

    @Transactional
    public MomentView publish(CommunityUser user, Map<String, String> body) {
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new FieldContractException("body", "动态正文不能为空");
        }
        Instant now = Instant.now();
        Moment moment = new Moment();
        moment.setId(TokenSupport.newId());
        moment.setAuthorId(user.getId());
        moment.setStatus("PUBLISHED");
        moment.setCreatedAt(now);
        moment.setUpdatedAt(now);
        momentMapper.insert(moment);

        MomentRevision revision = new MomentRevision();
        revision.setId(TokenSupport.newId());
        revision.setMomentId(moment.getId());
        revision.setBody(text.trim());
        revision.setRevisionNumber(1);
        revision.setCreatedAt(now);
        momentRevisionMapper.insert(revision);
        return toView(moment);
    }

    @Transactional
    public MomentView update(CommunityUser user, String momentId, Map<String, String> body) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !user.getId().equals(moment.getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!"PUBLISHED".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "只能编辑已发布的动态");
        }
        long elapsed = Instant.now().getEpochSecond() - moment.getCreatedAt().getEpochSecond();
        if (elapsed > communityProperties.getMomentEditWindowSeconds()) {
            throw new ContractException(ErrorCode.CONFLICT, "已超过可编辑时间窗口");
        }
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new FieldContractException("body", "动态正文不能为空");
        }
        Instant now = Instant.now();
        MomentRevision latest = momentRevisionMapper.findLatestByMomentId(momentId);
        int nextRevision = latest == null ? 1 : latest.getRevisionNumber() + 1;
        MomentRevision revision = new MomentRevision();
        revision.setId(TokenSupport.newId());
        revision.setMomentId(momentId);
        revision.setBody(text.trim());
        revision.setRevisionNumber(nextRevision);
        revision.setCreatedAt(now);
        momentRevisionMapper.insert(revision);
        moment.setUpdatedAt(now);
        momentMapper.updateById(moment);
        return toView(moment);
    }

    @Transactional
    public MomentView trash(CommunityUser user, String momentId) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !user.getId().equals(moment.getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        moment.setStatus("TRASHED");
        moment.setUpdatedAt(Instant.now());
        momentMapper.updateById(moment);
        return toView(moment);
    }

    private MomentView toView(Moment moment) {
        MomentRevision revision = momentRevisionMapper.findLatestByMomentId(moment.getId());
        return MomentView.builder()
                .id(moment.getId())
                .body(revision == null ? null : revision.getBody())
                .authorId(moment.getAuthorId())
                .createdAt(moment.getCreatedAt())
                .build();
    }
}
