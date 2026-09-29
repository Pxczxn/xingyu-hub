package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.AccountStatusView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.RecentAuthentication;
import top.pxczxn.xingyu.community.mapper.RecentAuthenticationMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecentAuthenticationService {

    private static final int VALID_MINUTES = 15;

    private final RecentAuthenticationMapper recentAuthMapper;

    @Transactional
    public Map<String, Object> reAuthenticate(CommunityUser user, CommunitySession session, String password) {
        if (!PasswordSupport.matches(password, user.getPasswordHash())) {
            throw new ContractException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        Instant now = Instant.now();
        RecentAuthentication record = new RecentAuthentication();
        record.setId(TokenSupport.newId());
        record.setUserId(user.getId());
        record.setSessionId(session.getId());
        record.setVerifiedAt(now);
        record.setExpiresAt(now.plus(VALID_MINUTES, ChronoUnit.MINUTES));
        recentAuthMapper.insert(record);
        return Map.of(
                "recentAuthId", record.getId(),
                "expiresAt", record.getExpiresAt().toString());
    }

    public void requireValidRecentAuth(CommunityUser user, CommunitySession session, String recentAuthId) {
        if (recentAuthId == null || recentAuthId.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "请先完成身份再认证");
        }
        RecentAuthentication record = recentAuthMapper.findByIdAndUserAndSession(
                recentAuthId, user.getId(), session.getId());
        if (record == null || record.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "身份再认证已过期，请重新验证");
        }
    }

    public AccountStatusView accountStatus(CommunityUser user) {
        String status = user.getStatus();
        boolean active = "ACTIVE".equals(status);
        return AccountStatusView.builder()
                .status(status)
                .canChangeEmail(active)
                .canChangePassword(active)
                .requiresReAuth(active)
                .allowedActions(active ? List.of("CHANGE_EMAIL", "CHANGE_PASSWORD", "MANAGE_SESSIONS") : List.of())
                .build();
    }
}
